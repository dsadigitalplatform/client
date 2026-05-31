'use client'

import { useEffect, useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import InputAdornment from '@mui/material/InputAdornment'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'

import {
  COUNTRY_CODE_MANUAL_SELECT_VALUE,
  COUNTRY_CODE_OPTIONS,
  COUNTRY_CODE_VALIDATION_MESSAGE,
  countryCodeToDigits,
  digitsToCountryCode,
  getCountryCodeOption,
  isPresetCountryCode,
  isValidCountryCode
} from '@/lib/countryCodes'

type Props = {
  value: string
  onChange: (code: string) => void
  label?: string
  labelId?: string
  error?: boolean
  helperText?: string
  fullWidth?: boolean
  sx?: SxProps<Theme>
}

const CountryCodeField = ({
  value,
  onChange,
  label = 'Country Code',
  labelId,
  error = false,
  helperText,
  fullWidth = true,
  sx
}: Props) => {
  const resolvedLabelId = labelId || 'country-code-field-label'
  const [manualMode, setManualMode] = useState(() => Boolean(value) && !isPresetCountryCode(value))

  useEffect(() => {
    if (!value) return

    if (!isPresetCountryCode(value)) {
      setManualMode(true)
    }
  }, [value])

  const selectedCountry = useMemo(() => getCountryCodeOption(value), [value])
  const manualDigits = countryCodeToDigits(value)
  const showValidationError = error || (value.length > 0 && !isValidCountryCode(value))
  const resolvedHelperText =
    helperText || (value.length > 0 && !isValidCountryCode(value) ? COUNTRY_CODE_VALIDATION_MESSAGE : ' ')

  const selectValue = manualMode ? COUNTRY_CODE_MANUAL_SELECT_VALUE : value

  if (manualMode) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: fullWidth ? '100%' : undefined, ...sx }}>
        <FormControl fullWidth={fullWidth} error={showValidationError}>
          <InputLabel id={resolvedLabelId}>{label}</InputLabel>
          <Select
            labelId={resolvedLabelId}
            label={label}
            value={COUNTRY_CODE_MANUAL_SELECT_VALUE}
            onChange={e => {
              const next = String(e.target.value)

              if (next === COUNTRY_CODE_MANUAL_SELECT_VALUE) return

              setManualMode(false)
              onChange(next)
            }}
          >
            {COUNTRY_CODE_OPTIONS.map(option => (
              <MenuItem key={`${option.iso}-${option.code}`} value={option.code}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{option.flag}</span>
                    <Typography variant='body2'>{option.name}</Typography>
                  </Box>
                  <Typography variant='body2' color='text.secondary'>
                    {option.code}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
            <Divider />
            <MenuItem value={COUNTRY_CODE_MANUAL_SELECT_VALUE}>Enter manually</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label='Custom code'
          value={manualDigits}
          onChange={e => onChange(digitsToCountryCode(e.target.value))}
          error={showValidationError}
          helperText={resolvedHelperText}
          fullWidth={fullWidth}
          inputProps={{ inputMode: 'numeric', maxLength: 3 }}
          InputProps={{
            startAdornment: <InputAdornment position='start'>+</InputAdornment>
          }}
        />
      </Box>
    )
  }

  return (
    <FormControl fullWidth={fullWidth} error={showValidationError} sx={sx}>
      <InputLabel id={resolvedLabelId}>{label}</InputLabel>
      <Select
        labelId={resolvedLabelId}
        label={label}
        value={selectValue}
        onChange={e => {
          const next = String(e.target.value)

          if (next === COUNTRY_CODE_MANUAL_SELECT_VALUE) {
            setManualMode(true)
            onChange(digitsToCountryCode(manualDigits))

            return
          }

          setManualMode(false)
          onChange(next)
        }}
        renderValue={() => `${selectedCountry.flag} ${selectedCountry.code}`}
      >
        {COUNTRY_CODE_OPTIONS.map(option => (
          <MenuItem key={`${option.iso}-${option.code}`} value={option.code}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>{option.flag}</span>
                <Typography variant='body2'>{option.name}</Typography>
              </Box>
              <Typography variant='body2' color='text.secondary'>
                {option.code}
              </Typography>
            </Box>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem value={COUNTRY_CODE_MANUAL_SELECT_VALUE}>Enter manually</MenuItem>
      </Select>
      {resolvedHelperText.trim() ? <FormHelperText>{resolvedHelperText}</FormHelperText> : null}
    </FormControl>
  )
}

export default CountryCodeField
