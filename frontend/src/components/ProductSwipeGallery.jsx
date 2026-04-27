import { useEffect, useMemo, useRef, useState } from 'react'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'

const AUTO_MS = 2000

/**
 * Multi-image: snap horizontal scroll, auto-advance every 2s (loops), dots jump on click.
 * @param {string[]} urls
 */
export function ProductSwipeGallery({ urls, alt = '', heightClass = 'h-[220px]', className }) {
  const list = useMemo(() => (Array.isArray(urls) ? urls.filter(Boolean) : []), [urls])

  if (!list.length) {
    return (
      <div
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground',
          heightClass,
          className,
        )}
      >
        <Package className="size-14 opacity-35" strokeWidth={1.25} />
        <span className="text-xs font-medium opacity-60">No image</span>
      </div>
    )
  }

  if (list.length === 1) {
    return (
      <img
        src={list[0]}
        alt={alt}
        className={cn('w-full object-cover', heightClass, className)}
        loading="lazy"
      />
    )
  }

  return <GalleryMulti urls={list} alt={alt} heightClass={heightClass} className={className} />
}

function GalleryMulti({ urls, alt, heightClass, className }) {
  const scrollerRef = useRef(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || urls.length < 2) return
    const w = el.clientWidth
    if (!w) return
    el.scrollTo({ left: index * w, behavior: 'smooth' })
  }, [index, urls])

  useEffect(() => {
    if (urls.length < 2) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % urls.length)
    }, AUTO_MS)
    return () => clearInterval(id)
  }, [urls.length])

  return (
    <div className={cn('relative w-full overflow-hidden', className)}>
      <div
        ref={scrollerRef}
        className={cn(
          'flex w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          heightClass,
        )}
      >
        {urls.map((src, i) => (
          <div key={`${src}-${i}`} className="w-full min-w-full shrink-0 snap-center">
            <img
              src={src}
              alt={i === 0 ? alt : ''}
              className={cn('h-full w-full object-cover', heightClass)}
              loading={i === 0 ? 'eager' : 'lazy'}
            />
          </div>
        ))}
      </div>
      <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-2">
        {urls.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Image ${i + 1} of ${urls.length}`}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => setIndex(i)}
            className={cn(
              'size-2.5 shrink-0 rounded-full border border-border/80 transition-colors',
              i === index ? 'bg-primary shadow-sm' : 'bg-background/90 hover:bg-muted',
            )}
          />
        ))}
      </div>
    </div>
  )
}
