import { useState, useRef, useEffect } from 'react'
import { X, ZoomIn, ZoomOut, Check } from 'lucide-react'

interface Props {
  file: File
  onConfirm: (blob: Blob) => void
  onClose: () => void
}

const CONTAINER_SIZE = 280

export default function AvatarCropModal({ file, onConfirm, onClose }: Props) {
  const [imageUrl, setImageUrl] = useState('')
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })

  const imgRef = useRef<HTMLImageElement>(null)
  const draggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const positionRef = useRef({ x: 0, y: 0 })
  const scaleRef = useRef(1)
  const naturalSizeRef = useRef({ w: 0, h: 0 })

  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { positionRef.current = position }, [position])
  useEffect(() => { naturalSizeRef.current = naturalSize }, [naturalSize])

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const getMinScale = (nat: { w: number; h: number }) =>
    nat.w > 0 ? Math.max(CONTAINER_SIZE / nat.w, CONTAINER_SIZE / nat.h) : 1

  const clampPos = (pos: { x: number; y: number }, sc: number, nat: { w: number; h: number }) => {
    const imgW = nat.w * sc
    const imgH = nat.h * sc
    const maxX = Math.max(0, (imgW - CONTAINER_SIZE) / 2)
    const maxY = Math.max(0, (imgH - CONTAINER_SIZE) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, pos.x)),
      y: Math.min(maxY, Math.max(-maxY, pos.y)),
    }
  }

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const nat = { w: img.naturalWidth, h: img.naturalHeight }
    const minSc = getMinScale(nat)
    setNaturalSize(nat)
    naturalSizeRef.current = nat
    setScale(minSc)
    scaleRef.current = minSc
    setPosition({ x: 0, y: 0 })
    positionRef.current = { x: 0, y: 0 }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = true
    dragStartRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    const t = e.touches[0]
    draggingRef.current = true
    dragStartRef.current = {
      x: t.clientX - positionRef.current.x,
      y: t.clientY - positionRef.current.y,
    }
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const raw = { x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y }
      const clamped = clampPos(raw, scaleRef.current, naturalSizeRef.current)
      positionRef.current = clamped
      setPosition({ ...clamped })
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) return
      const t = e.touches[0]
      const raw = { x: t.clientX - dragStartRef.current.x, y: t.clientY - dragStartRef.current.y }
      const clamped = clampPos(raw, scaleRef.current, naturalSizeRef.current)
      positionRef.current = clamped
      setPosition({ ...clamped })
    }
    const onUp = () => { draggingRef.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [])

  const handleZoom = (newScale: number) => {
    const nat = naturalSizeRef.current
    const minSc = getMinScale(nat)
    const clamped = Math.max(minSc, Math.min(minSc * 4, newScale))
    scaleRef.current = clamped
    setScale(clamped)
    setPosition(p => {
      const np = clampPos(p, clamped, nat)
      positionRef.current = np
      return np
    })
  }

  const handleConfirm = () => {
    if (!imgRef.current) return
    const OUTPUT = 400
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')!
    ctx.beginPath()
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2)
    ctx.clip()

    const nat = naturalSizeRef.current
    const sc = scaleRef.current
    const pos = positionRef.current
    const imgW = nat.w * sc
    const imgH = nat.h * sc
    const srcX = ((imgW - CONTAINER_SIZE) / 2 - pos.x) / sc
    const srcY = ((imgH - CONTAINER_SIZE) / 2 - pos.y) / sc
    const srcW = CONTAINER_SIZE / sc
    const srcH = CONTAINER_SIZE / sc

    ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, OUTPUT, OUTPUT)
    canvas.toBlob(blob => { if (blob) onConfirm(blob) }, 'image/jpeg', 0.92)
  }

  const nat = naturalSize
  const imgW = nat.w * scale
  const imgH = nat.h * scale
  const minScale = getMinScale(nat)

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-[360px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E4E7]">
          <h3 className="font-semibold text-[#18181B]">Фото профиля</h3>
          <button onClick={onClose} className="text-[#71717A] hover:text-[#18181B] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 p-5">
          <p className="text-sm text-[#71717A] text-center">Перетащите фото, чтобы выровнять</p>

          {/* Circular crop area */}
          <div
            className="relative overflow-hidden rounded-full cursor-grab active:cursor-grabbing select-none"
            style={{ width: CONTAINER_SIZE, height: CONTAINER_SIZE, background: '#18181B', flexShrink: 0 }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            {imageUrl && (
              <img
                ref={imgRef}
                src={imageUrl}
                alt=""
                onLoad={handleImageLoad}
                draggable={false}
                style={{
                  position: 'absolute',
                  width: imgW || 'auto',
                  height: imgH || 'auto',
                  left: imgW ? `${(CONTAINER_SIZE - imgW) / 2 + position.x}px` : 0,
                  top: imgH ? `${(CONTAINER_SIZE - imgH) / 2 + position.y}px` : 0,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />
            )}
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-3 w-full px-1">
            <button
              onClick={() => handleZoom(scale - minScale * 0.15)}
              className="text-[#71717A] hover:text-[#18181B] transition-colors flex-shrink-0"
            >
              <ZoomOut size={18} />
            </button>
            <input
              type="range"
              min={minScale}
              max={minScale * 4}
              step={minScale * 0.02}
              value={scale}
              onChange={e => handleZoom(parseFloat(e.target.value))}
              className="flex-1 accent-[#CC0033]"
            />
            <button
              onClick={() => handleZoom(scale + minScale * 0.15)}
              className="text-[#71717A] hover:text-[#18181B] transition-colors flex-shrink-0"
            >
              <ZoomIn size={18} />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-[#E4E4E7] rounded-lg text-sm font-medium text-[#52525B] hover:bg-[#FAFAFA] transition-colors"
          >
            Отмена
          </button>
          <button onClick={handleConfirm} className="btn btn-primary flex-1 justify-center">
            <Check size={16} /> Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
