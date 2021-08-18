import React from 'react'
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles'
import { FormControl, InputLabel, MenuItem, Select as SelectMaterialUi, SelectProps } from '@material-ui/core'
import { withState } from 'reaclette'

import IntlMessage from './IntlMessage'

type AdditionalProps = Record<string, any>

export type Options<T> = {
  render: { (item: T, additionalProps?: AdditionalProps): React.ReactNode }
  value: { (item: T, additionalProps?: AdditionalProps): string | ReadonlyArray<string> | number }
}

interface ParentState {}

interface State {
  useStyles: () => Record<'formControl' | 'selectEmpty', string>
}

interface Props extends SelectProps {
  additionalProps?: AdditionalProps
  collection: unknown[] | undefined
  label?: React.ReactNode
  onChange: (e: React.ChangeEvent<{ value: Props['value'] }>) => void
  optionsRender: Options<any>
  value: any
}

interface ParentEffects {}

interface Effects {}

interface Computed {}

const Select = withState<State, Props, Effects, Computed, ParentState, ParentEffects>(
  {
    initialState: () => ({
      useStyles: makeStyles((theme: Theme) =>
        createStyles({
          formControl: {
            margin: theme.spacing(1),
            minWidth: 120,
          },
          selectEmpty: {
            marginTop: theme.spacing(2),
          },
        })
      ),
    }),
  },
  ({ additionalProps, collection, effects, label, multiple, optionsRender, resetState, state, required, ...props }) => (
    <FormControl className={state.useStyles().formControl}>
      {label !== undefined && <InputLabel>{label}</InputLabel>}
      <SelectMaterialUi multiple={multiple} required={required} {...props}>
        {!required && !multiple && (
          <MenuItem value=''>
            <em>
              <IntlMessage id='none' />
            </em>
          </MenuItem>
        )}
        {collection?.map((item, index) => (
          <MenuItem key={index} value={optionsRender.value(item, additionalProps)}>
            {optionsRender.render(item, additionalProps)}
          </MenuItem>
        ))}
      </SelectMaterialUi>
    </FormControl>
  )
)

export default Select
