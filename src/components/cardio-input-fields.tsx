import {
  cardioRateModeOptionLabel,
  cardioRateModes,
  type CardioRateMode,
} from '#/lib/cardio-rate'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type CardioUnitLabelInputProps = {
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  onBlurPersist: (value: string) => void
  className?: string
}

export function CardioUnitLabelInput({
  value,
  disabled,
  onChange,
  onBlurPersist,
  className,
}: CardioUnitLabelInputProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label
        htmlFor="cardio-unit-label"
        className="mb-1.5 block text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)] uppercase"
      >
        Unit
      </Label>
      <Input
        id="cardio-unit-label"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlurPersist(event.target.value)}
        className="h-11 text-base"
        placeholder="e.g. miles"
        autoComplete="off"
        autoCorrect="off"
      />
    </div>
  )
}

type CardioRateModeSelectProps = {
  value: CardioRateMode
  unitLabel: string
  disabled?: boolean
  onChange: (mode: CardioRateMode) => void
  className?: string
}

export function CardioRateModeSelect({
  value,
  unitLabel,
  disabled,
  onChange,
  className,
}: CardioRateModeSelectProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label
        htmlFor="cardio-rate-mode"
        className="mb-1.5 block text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)] uppercase"
      >
        Rate
      </Label>
      <select
        id="cardio-rate-mode"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value as CardioRateMode)
        }}
        className="h-11 w-full border border-input bg-transparent px-2.5 text-base text-[var(--sea-ink)] outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        {cardioRateModes.map((mode) => (
          <option key={mode} value={mode}>
            {cardioRateModeOptionLabel(mode, unitLabel)}
          </option>
        ))}
      </select>
    </div>
  )
}

type CardioMetricInputProps = {
  setId: string
  label: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  onBlurPersist: (value: string) => void
}

export function CardioMetricInput({
  setId,
  label,
  value,
  disabled,
  onChange,
  onBlurPersist,
}: CardioMetricInputProps) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={`metric-${setId}`}
        className="mb-1 block text-[0.65rem] font-medium tracking-wide text-[var(--sea-ink-soft)] uppercase"
      >
        {label}
      </Label>
      <Input
        id={`metric-${setId}`}
        inputMode="decimal"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlurPersist(event.target.value)}
        className="h-11 text-base"
        placeholder="0"
      />
    </div>
  )
}

type CardioDurationInputProps = {
  setId: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  onBlurPersist: (value: string) => void
}

export function CardioDurationInput({
  setId,
  value,
  disabled,
  onChange,
  onBlurPersist,
}: CardioDurationInputProps) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={`duration-${setId}`}
        className="mb-1 block text-[0.65rem] font-medium tracking-wide text-[var(--sea-ink-soft)] uppercase"
      >
        Time
      </Label>
      <Input
        id={`duration-${setId}`}
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlurPersist(event.target.value)}
        className="h-11 text-base"
        placeholder="0:00"
        autoComplete="off"
        autoCorrect="off"
      />
    </div>
  )
}

type CardioRateDisplayProps = {
  value: string | null
}

export function CardioRateDisplay({ value }: CardioRateDisplayProps) {
  return (
    <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
      {value ?? '—'}
    </p>
  )
}
