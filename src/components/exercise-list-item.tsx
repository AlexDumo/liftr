import { Star } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export type ExerciseListItemData = {
  id: string
  name: string
  equipment: string | null
  primaryMuscles: string[]
  imageUrl: string | null
  description: string | null
  favorited: boolean
}

type ExerciseListItemProps = {
  exercise: ExerciseListItemData
  onSelect: () => void
  onToggleFavorite: () => void
  busy?: boolean
}

export function ExerciseListItem({
  exercise,
  onSelect,
  onToggleFavorite,
  busy,
}: ExerciseListItemProps) {
  return (
    <div className="flex items-stretch gap-2 border-b border-[var(--line)] last:border-b-0">
      <button
        type="button"
        onClick={onSelect}
        disabled={busy}
        className="flex min-w-0 flex-1 items-start gap-3 px-1 py-3 text-left transition-colors hover:bg-[var(--surface)] disabled:opacity-50"
      >
        {exercise.imageUrl ? (
          <img
            src={exercise.imageUrl}
            alt=""
            className="size-20 shrink-0 object-cover"
            loading="lazy"
          />
        ) : (
          <div className="size-20 shrink-0 bg-[var(--sand)]" />
        )}
        <span className="min-w-0 pt-0.5">
          <span className="block truncate font-medium text-[var(--sea-ink)]">
            {exercise.name}
          </span>
          <span className="mt-0.5 block line-clamp-1 text-xs text-[var(--sea-ink-soft)]">
            {[exercise.equipment, exercise.primaryMuscles.slice(0, 2).join(', ')]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {exercise.description ? (
            <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-[var(--sea-ink-soft)]">
              {exercise.description}
            </span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        aria-label={
          exercise.favorited ? 'Remove favorite' : 'Favorite for this day'
        }
        onClick={(event) => {
          event.stopPropagation()
          onToggleFavorite()
        }}
        disabled={busy}
        className="flex w-12 shrink-0 items-center justify-center text-[var(--sea-ink-soft)] transition-colors hover:text-[var(--lagoon-deep)] disabled:opacity-50"
      >
        <Star
          weight={exercise.favorited ? 'fill' : 'regular'}
          className={cn(
            'size-5',
            exercise.favorited && 'text-[var(--lagoon-deep)]',
          )}
        />
      </button>
    </div>
  )
}
