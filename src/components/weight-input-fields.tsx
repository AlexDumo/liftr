import { Link } from '@tanstack/react-router'
import {
  formatPoundsDisplay,
  toPounds,
  weightInputTypeLabels,
  weightInputTypes,
  type WeightInputType,
} from '#/lib/weight-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type WeightDraftFields = {
  primary: string
}

type WeightInputFieldsProps = {
  setId: string
  setLabel: string
  inputType: WeightInputType
  fields: WeightDraftFields
  bodyWeightLbs: number | null
  barWeightLbs?: number | null
  disabled?: boolean
  onFieldsChange: (fields: WeightDraftFields) => void
  onBlurPersist: (fields: WeightDraftFields) => void
  className?: string
}

function primaryLabel(type: WeightInputType): string {
  switch (type) {
    case 'single':
      return 'Weight'
    case 'dumbbell':
      return 'Each'
    case 'barbell':
      return 'One side'
    case 'body':
      return 'Assistance'
    case 'cardio':
      return 'Metric'
  }
}

function primaryPlaceholder(type: WeightInputType): string {
  switch (type) {
    case 'body':
      return '0'
    default:
      return '0'
  }
}

export function computeDraftPounds(
  inputType: WeightInputType,
  fields: WeightDraftFields,
  bodyWeightLbs: number | null,
  barWeightLbs?: number | null,
): number | null {
  const primaryTrimmed = fields.primary.trim()
  if (!primaryTrimmed) return null

  const primary = Number(primaryTrimmed)
  if (!Number.isFinite(primary)) return null

  if (
    inputType === 'barbell' &&
    barWeightLbs !== undefined &&
    barWeightLbs !== null &&
    !Number.isFinite(barWeightLbs)
  ) {
    return null
  }

  return toPounds(
    inputType,
    {
      primary,
      barWeightLbs: inputType === 'barbell' ? (barWeightLbs ?? undefined) : undefined,
    },
    { bodyWeightLbs },
  )
}

export function WeightInputFields({
  setId,
  setLabel,
  inputType,
  fields,
  bodyWeightLbs,
  barWeightLbs,
  disabled,
  onFieldsChange,
  onBlurPersist,
  className,
}: WeightInputFieldsProps) {
  const pounds = computeDraftPounds(
    inputType,
    fields,
    bodyWeightLbs,
    barWeightLbs,
  )
  const poundsDisplay = formatPoundsDisplay(pounds)
  const needsBodyWeight = inputType === 'body' && bodyWeightLbs === null

  return (
    <div className={cn('space-y-1.5', className)}>
      <div>
        <Label
          htmlFor={`weight-${setId}`}
          className="mb-1 block text-[0.65rem] font-medium tracking-wide text-[var(--sea-ink-soft)] uppercase"
        >
          {primaryLabel(inputType)}
          <span className="sr-only"> for set {setLabel}</span>
        </Label>
        <Input
          id={`weight-${setId}`}
          inputMode="decimal"
          value={fields.primary}
          disabled={disabled || needsBodyWeight}
          placeholder={primaryPlaceholder(inputType)}
          className="h-11 text-base"
          onChange={(event) => {
            onFieldsChange({ ...fields, primary: event.target.value })
          }}
          onBlur={(event) =>
            onBlurPersist({ ...fields, primary: event.target.value })
          }
        />
      </div>

      {needsBodyWeight ? (
        <p className="text-xs text-[var(--sea-ink-soft)]">
          Set your{' '}
          <Link
            to="/settings"
            className="underline underline-offset-2 hover:text-[var(--sea-ink)]"
          >
            body weight
          </Link>{' '}
          first.
        </p>
      ) : poundsDisplay !== null ? (
        <p className="text-xs text-[var(--sea-ink-soft)]">= {poundsDisplay} lb</p>
      ) : inputType === 'body' ? (
        <p className="text-xs text-[var(--sea-ink-soft)]">
          Assistance subtracts from body weight
        </p>
      ) : null}
    </div>
  )
}

type WeightInputTypeSelectProps = {
  value: WeightInputType
  disabled?: boolean
  onChange: (type: WeightInputType) => void
}

export function WeightInputTypeSelect({
  value,
  disabled,
  onChange,
}: WeightInputTypeSelectProps) {
  return (
    <div>
      <Label
        htmlFor="weight-input-type"
        className="mb-1.5 block text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)] uppercase"
      >
        Input type
      </Label>
      <select
        id="weight-input-type"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value as WeightInputType)
        }}
        className="h-11 w-full border border-input bg-transparent px-2.5 text-base text-[var(--sea-ink)] outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        {weightInputTypes.map((type) => (
          <option key={type} value={type}>
            {weightInputTypeLabels[type]}
          </option>
        ))}
      </select>
    </div>
  )
}

type BarWeightInputProps = {
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  onBlurPersist: (value: string) => void
}

export function BarWeightInput({
  value,
  disabled,
  onChange,
  onBlurPersist,
}: BarWeightInputProps) {
  return (
    <div>
      <Label
        htmlFor="bar-weight"
        className="mb-1.5 block text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)] uppercase"
      >
        Bar
      </Label>
      <Input
        id="bar-weight"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        placeholder="45"
        className="h-11 text-base"
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlurPersist(event.target.value)}
      />
    </div>
  )
}
