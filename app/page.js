'use client'

import { useState, useEffect, useRef } from 'react'
import ReactImageCrop, { cropToCanvas } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import './page.css'
import { SUPPORTED_LOCALES, LOCALE_LABELS, getDisclaimerText } from '@/lib/locales'

export default function Home() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)
  const [selectedFilter, setSelectedFilter] = useState('')
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [totalPages, setTotalPages] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [fieldChoices, setFieldChoices] = useState([])
  const [disclaimerMessages, setDisclaimerMessages] = useState({})
  const [noneChoiceId, setNoneChoiceId] = useState('6a8fe45342cbe42b37253990')
  const [selectedFilters, setSelectedFilters] = useState(new Set())
  const [selectedAssetAiStatus, setSelectedAssetAiStatus] = useState(null)
  const [crop, setCrop] = useState({ unit: 'px', width: 0, height: 0, x: 0, y: 0 })
  const [completedCrop, setCompletedCrop] = useState(null)
  const [selectedLocale, setSelectedLocale] = useState('en')
  const imgRef = useRef(null)

  const limit = 20

  useEffect(() => {
    fetchFieldChoices()
  }, [])


  useEffect(() => {
    fetchAssets()
  }, [page, selectedFilters, noneChoiceId])

  const fetchFieldChoices = async () => {
    try {
      // Try to load static field choices from build-time data first
      const staticResponse = await fetch('/data/field-choices.json')

      if (staticResponse.ok) {
        const data = await staticResponse.json()
        const { choices, disclaimerMessages, noneChoiceId } = data

        setFieldChoices(choices)
        setNoneChoiceId(noneChoiceId)
        setDisclaimerMessages(disclaimerMessages)

        // Set all choices as selected by default
        const allChoiceIds = new Set(choices.map((c) => c.id))
        setSelectedFilters(allChoiceIds)
        return
      }

      // Fall back to API call if static file doesn't exist
      const response = await fetch('/api/fields')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch field choices')
      }

      const field = data.data?.[0]
      if (field && field.choices) {
        const noneId = data.none_choice_id
        if (noneId) {
          setNoneChoiceId(noneId)
        }

        const choices = field.choices.filter((c) => c.id !== noneId)
        setFieldChoices(choices)

        const messages = {}
        field.choices.forEach((choice) => {
          if (choice.id !== noneId) {
            messages[choice.id] = choice.name
          }
        })
        setDisclaimerMessages(messages)

        const allChoiceIds = new Set(choices.map((c) => c.id))
        setSelectedFilters(allChoiceIds)
      }
    } catch (err) {
      console.error('Failed to fetch field choices:', err)
    }
  }

  const fetchAssets = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })

      if (selectedFilters.size > 0) {
        // Filter by selected choices (comma-separated)
        params.append('filters', Array.from(selectedFilters).join(','))
      } else if (noneChoiceId) {
        // "All" means all AI-assisted (exclude "None")
        params.append('filter', `exclude:${noneChoiceId}`)
      }

      const response = await fetch(`/api/assets?${params}`)
      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.details || data.error || 'Failed to fetch assets'
        throw new Error(errorMsg)
      }

      setAssets(data.data || data.items || [])
      const totalAssets = data.total_count || data.totalCount || 0
      const totalPages = Math.ceil(totalAssets / limit) || 1
      setTotalPages(totalPages)
      setSelectedAsset(null)
      setSelectedAssetAiStatus(null)
      setCompletedCrop(null)
      setCrop({ unit: 'px', width: 0, height: 0, x: 0, y: 0 })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }



  const fetchAssetAiStatus = async (assetId) => {
    try {
      const fieldsResponse = await fetch(`/api/asset-fields?assetId=${assetId}`)
      if (fieldsResponse.ok) {
        const fieldsData = await fieldsResponse.json()
        const field = fieldsData.field
        if (field) {
          const values = field.values || field.value
          if (values) {
            const choiceId = Array.isArray(values) ? values[0] : values
            setSelectedAssetAiStatus({
              choiceId,
              message: disclaimerMessages[choiceId],
            })
            return
          }
        }
      }
      setSelectedAssetAiStatus(null)
    } catch (err) {
      console.log('Could not fetch asset AI status:', err.message)
      setSelectedAssetAiStatus(null)
    }
  }

  const getLocalizedDisclaimerMessage = (choiceId) => {
    return getDisclaimerText(choiceId, selectedLocale)
  }

  const handleFilterChange = (choiceId) => {
    const newFilters = new Set(selectedFilters)

    if (choiceId === 'all') {
      // Only allow checking all, not unchecking
      if (newFilters.size < fieldChoices.length) {
        fieldChoices.forEach((choice) => newFilters.add(choice.id))
      }
    } else {
      // Toggle individual choice
      if (newFilters.has(choiceId)) {
        // Only uncheck if there's more than one checked
        if (newFilters.size > 1) {
          newFilters.delete(choiceId)
        }
        // If it's the only one, don't uncheck it
      } else {
        newFilters.add(choiceId)
      }
    }

    setSelectedFilters(newFilters)
    setSelectedFilter(newFilters.size > 0 ? Array.from(newFilters)[0] : '')
    setPage(0)
  }

  const handleDownload = async () => {
    if (!selectedAsset) return

    setDownloading(true)
    try {
      let publicUrl = selectedAsset.url || selectedAsset.thumbnail_url
      if (!publicUrl) {
        throw new Error('No download URL available')
      }

      let blob
      const choiceId = selectedAssetAiStatus?.choiceId

      // If we found a valid AI status field value, add disclaimer to the image
      if (choiceId) {
        const finalFilename = selectedAsset.name || selectedAsset.title || `image-${selectedAsset.id}`
        const params = new URLSearchParams({
          imageUrl: publicUrl,
          choiceId,
          locale: selectedLocale,
          filename: finalFilename,
        })
        if (completedCrop && completedCrop.width && completedCrop.height && imgRef.current) {
          const displayWidth = imgRef.current.width
          const displayHeight = imgRef.current.height
          const naturalWidth = imgRef.current.naturalWidth
          const naturalHeight = imgRef.current.naturalHeight

          // Only scale if displayed size differs from natural size (large images constrained by viewport)
          if (displayWidth !== naturalWidth || displayHeight !== naturalHeight) {
            const scaleX = naturalWidth / displayWidth
            const scaleY = naturalHeight / displayHeight

            params.append('cropX', Math.round(completedCrop.x * scaleX))
            params.append('cropY', Math.round(completedCrop.y * scaleY))
            params.append('cropWidth', Math.round(completedCrop.width * scaleX))
            params.append('cropHeight', Math.round(completedCrop.height * scaleY))
          } else {
            params.append('cropX', Math.round(completedCrop.x))
            params.append('cropY', Math.round(completedCrop.y))
            params.append('cropWidth', Math.round(completedCrop.width))
            params.append('cropHeight', Math.round(completedCrop.height))
          }
        }
        const apiUrl = `/api/image-with-disclaimer?${params}`
        const response = await fetch(apiUrl)
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Failed to add disclaimer: ${response.status} ${errorText}`)
        }
        blob = await response.blob()
      } else {
        console.log('Downloading without disclaimer')
        const response = await fetch(publicUrl)
        blob = await response.blob()
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = selectedAsset.name || selectedAsset.title || `image-${selectedAsset.id}`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)
      console.log('Download completed')
    } catch (err) {
      console.error('Download error:', err)
      setError(`Download error: ${err.message}`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="container">
      <header className="header">
        <h1>AI Disclaimer Tool</h1>
        <p>Browse and download images with AI disclosure information</p>
      </header>

      <div className="controls">
        <div className="filter-section">
          <label>Filter by level of AI assistance</label>
          <div className="filter-checkboxes">
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="filter-all"
                checked={selectedFilters.size === fieldChoices.length && fieldChoices.length > 0}
                onChange={() => handleFilterChange('all')}
                disabled={selectedFilters.size === fieldChoices.length && fieldChoices.length > 0}
              />
              <label htmlFor="filter-all">All AI-assisted Images</label>
            </div>
            {fieldChoices.map((choice) => {
              const isChecked = selectedFilters.has(choice.id)
              const isOnlyOne = selectedFilters.size === 1 && isChecked
              return (
                <div key={choice.id} className="checkbox-group">
                  <input
                    type="checkbox"
                    id={`filter-${choice.id}`}
                    checked={isChecked}
                    onChange={() => handleFilterChange(choice.id)}
                    disabled={isOnlyOne}
                  />
                  <label htmlFor={`filter-${choice.id}`}>{choice.name}</label>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="gallery">
        {loading ? (
          <div className="loading-container" style={{ width: '100%', margin: '0 -1.5rem' }}>
            <div className="spinner"></div>
          </div>
        ) : (
          <>
            {assets.map((asset) => (
              <div
                key={asset.id}
                className={`gallery-item ${
                  selectedAsset?.id === asset.id ? 'selected' : ''
                }`}
                onClick={() => {
                  setSelectedAsset(asset)
                  setCompletedCrop(null)
                  setCrop({ unit: 'px', width: 0, height: 0, x: 0, y: 0 })
                  fetchAssetAiStatus(asset.id)
                }}
              >
                <img
                  src={`${asset.thumbnail_url || asset.url}?width=150&height=150`}
                  alt={asset.name || asset.title}
                  className="gallery-image"
                />
                <p className="gallery-name">{asset.name || asset.title || 'Untitled'}</p>
              </div>
            ))}
            {assets.length === 0 && (
              <div className="no-results">No images found</div>
            )}
          </>
        )}
      </div>

      {!loading && (
        <div className="pagination">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0 || loading}
              className="pagination-btn"
            >
              Previous
            </button>
            <span className="pagination-info">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1 || loading}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
      )}

      {selectedAsset && (
        <div className="preview-section">
          <div className="preview-container">
            <div className="crop-section">
              <ReactImageCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={undefined}
              >
                <img
                  ref={imgRef}
                  src={selectedAsset.url || selectedAsset.thumbnail_url}
                  alt={selectedAsset.name}
                  className="preview-image"
                />
              </ReactImageCrop>
              {completedCrop && completedCrop.width > 0 && completedCrop.height > 0 && imgRef.current && (
                <>
                  <div className="crop-info">
                    {(() => {
                      const displayWidth = imgRef.current.width
                      const displayHeight = imgRef.current.height
                      const naturalWidth = imgRef.current.naturalWidth
                      const naturalHeight = imgRef.current.naturalHeight

                      let width = Math.round(completedCrop.width)
                      let height = Math.round(completedCrop.height)

                      // Only scale if displayed size differs from natural size
                      if (displayWidth !== naturalWidth || displayHeight !== naturalHeight) {
                        const scaleX = naturalWidth / displayWidth
                        const scaleY = naturalHeight / displayHeight
                        width = Math.round(completedCrop.width * scaleX)
                        height = Math.round(completedCrop.height * scaleY)
                      }

                      return `Final crop: ${width} × ${height} px`
                    })()}
                  </div>
                  <button
                    onClick={() => {
                      setCompletedCrop(null)
                      setCrop({ unit: 'px', width: 0, height: 0, x: 0, y: 0 })
                    }}
                    className="clear-crop-btn"
                  >
                    Clear Crop
                  </button>
                </>
              )}
            </div>
            <div className="preview-details">
              <h2>{selectedAsset.name}</h2>
              <div className="download-controls">
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="download-btn"
                >
                  {downloading ? 'Downloading...' : 'Download'}
                  {!downloading && (
                    <svg style={{width: '20px', height: '20px'}} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 4 10.59 5.41 16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
                    </svg>
                  )}
                </button>
                <select
                  value={selectedLocale}
                  onChange={(e) => setSelectedLocale(e.target.value)}
                  className="locale-select"
                  title="Select language for disclaimer"
                >
                  {SUPPORTED_LOCALES.map((locale) => (
                    <option key={locale} value={locale}>
                      {LOCALE_LABELS[locale]}
                    </option>
                  ))}
                </select>
              </div>
              {selectedAssetAiStatus && selectedAssetAiStatus.choiceId && (
                <div className="disclaimer">
                  {getLocalizedDisclaimerMessage(selectedAssetAiStatus.choiceId)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
