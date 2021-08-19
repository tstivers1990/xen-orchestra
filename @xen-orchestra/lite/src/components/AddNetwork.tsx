import React, { ChangeEvent, FormEventHandler } from 'react'
import { Map } from 'immutable'
import { withState } from 'reaclette'

import Button from './Button'
import Input from './Input'
import IntlMessage from './IntlMessage'
import Select, { Options } from './Select'
import { alert } from './Modal'

import XapiConnection, { ObjectsByType, Pif, PifMetrics } from '../libs/xapi'

interface ParentState {
  objectsByType: ObjectsByType
  objectsFetched: boolean
  xapi: XapiConnection
}

interface State {
  formRef: React.RefObject<HTMLFormElement>
  isBonded: boolean
  form: {
    [key: string]: unknown
    bondModeValue: 'balance-slb' | 'active-backup' | 'lacp' | ''
    descriptionValue: string
    mtuValue: string
    nameLabelValue: string
    vlanValue: string
  }
  pifsIdRef: React.RefObject<any>
}

interface Props {}

interface ParentEffects {}

interface Effects {
  _createNetwork: FormEventHandler<HTMLFormElement>
  _resetForm: () => void
  _toggleBonded: () => void
  _handleChange: (e: ChangeEvent<HTMLInputElement>) => void
}

interface Computed {
  collection?: Pif[]
  pifs?: Map<string, Pif>
  pifsMetrics?: Map<string, PifMetrics>
}

const OPTIONS_RENDER_PIF: Options<Pif> = {
  render: (pif, additionalProps) =>
    `${pif.device} (${
      additionalProps?.pifsMetrics?.find((metrics: PifMetrics) => metrics.$ref === pif.metrics)?.device_name ??
      'unknown'
    })`,
  value: pif => pif.$id,
}
const OPTIONS_RENDER_BOND_MODE: Options<string[]> = {
  render: mode => mode,
  value: mode => mode,
}
const BOND_MODE = ['balance-slb', 'active-backup', 'lacp']

const AddNetwork = withState<State, Props, Effects, Computed, ParentState, ParentEffects>(
  {
    initialState: () => ({
      formRef: React.createRef(),
      isBonded: false,
      form: {
        bondModeValue: '',
        descriptionValue: '',
        mtuValue: '',
        nameLabelValue: '',
        vlanValue: '',
      },
      pifsIdRef: React.createRef(),
    }),
    computed: {
      pifs: state => state.objectsByType.get('PIF'),
      pifsMetrics: state => state.objectsByType.get('PIF_metrics'),
      collection: state =>
        state.pifs
          ?.filter(pif => pif.VLAN === -1 && pif.bond_slave_of === 'OpaqueRef:NULL' && pif.host === pif.$pool.master)
          .sortBy(pif => pif.device)
          .valueSeq()
          .toArray(),
    },
    effects: {
      _handleChange: function (e) {
        // Reason why values are initialized with empty string and not a undefined value
        // Warning: A component is changing an uncontrolled input to be controlled.
        // This is likely caused by the value changing from undefined to a defined value,
        // which should not happen. Decide between using a controlled or uncontrolled input
        // element for the lifetime of the component.
        // More info: https://reactjs.org/link/controlled-components
        const stateProperty = e.target.name
        const form = this.state.form

        if (form[stateProperty] !== undefined) {
          this.state.form = {
            ...form,
            [stateProperty]: e.target.value,
          }
        }
      },
      _createNetwork: async function (e) {
        e.preventDefault()

        const { nameLabelValue, vlanValue, mtuValue, bondModeValue, descriptionValue } = this.state.form
        const { current } = this.state.formRef
        const pifsId: string | string[] | undefined = this.state.isBonded
          ? Array.from<HTMLOptionElement>(current?.pif.selectedOptions).map(({ value }) => value)
          : current?.pif.value

        try {
          await this.state.xapi.createNetwork(
            {
              name_label: nameLabelValue,
              name_description: descriptionValue,
              MTU: +mtuValue,
              VLAN: +vlanValue,
            },
            { pifsId, bondMode: bondModeValue === '' ? undefined : bondModeValue }
          )
          this.effects._resetForm()
        } catch (error) {
          alert({ message: <p>{error.message}</p>, title: <IntlMessage id='networkCreation' /> })
        }
      },
      _resetForm: function () {
        Object.keys(this.state.form).forEach(key => {
          this.state.form = {
            ...this.state.form,
            [key]: '',
          }
        })
        this.state.isBonded = false
      },
      _toggleBonded: function () {
        this.state.isBonded = !this.state.isBonded
      },
    },
  },
  ({ effects, state }) => (
    <>
      <form onSubmit={effects._createNetwork} ref={state.formRef}>
        <div>
          <label>
            <IntlMessage id='bondedNetwork' />
          </label>
          <Input checked={state.isBonded} name='bonded' onChange={effects._toggleBonded} type='checkbox' />
        </div>
        <div>
          <label>
            <IntlMessage id='interface' />
          </label>
          <Select
            additionalProps={{ pifsMetrics: state.pifsMetrics }}
            collection={state.collection}
            multiple={state.isBonded}
            name='pif'
            optionsRender={OPTIONS_RENDER_PIF}
            placeholder='selectPif'
            required={state.isBonded}
          />
        </div>
        <div>
          <label>
            <IntlMessage id='name' />
          </label>
          <Input
            name='nameLabelValue'
            required
            type='text'
            value={state.form.nameLabelValue}
            onChange={effects._handleChange}
          />
        </div>
        <div>
          <label>
            <IntlMessage id='description' />
          </label>
          <Input
            name='descriptionValue'
            value={state.form.descriptionValue}
            type='text'
            onChange={effects._handleChange}
          />
        </div>
        <div>
          <label>
            <IntlMessage id='mtu' />
          </label>
          <IntlMessage id='defaultValue' values={{ value: 1500 }}>
            {message => (
              <Input
                name='mtuValue'
                placeholder={message?.toString()}
                type='number'
                value={state.form.mtuValue}
                onChange={effects._handleChange}
              />
            )}
          </IntlMessage>
        </div>
        {state.isBonded ? (
          <div>
            <label>
              <IntlMessage id='bondMode' />
            </label>
            <Select
              collection={BOND_MODE}
              name='bondMode'
              optionsRender={OPTIONS_RENDER_BOND_MODE}
              placeholder='selectBondMode'
              required
            />
          </div>
        ) : (
          <div>
            <label>
              <IntlMessage id='vlan' />
            </label>
            <IntlMessage id='vlanPlaceholder'>
              {message => (
                <Input
                  name='vlanValue'
                  placeholder={message?.toString()}
                  type='number'
                  value={state.form.vlanValue}
                  onChange={effects._handleChange}
                />
              )}
            </IntlMessage>
          </div>
        )}
        <Button type='submit'>
          <IntlMessage id='create' />
        </Button>
      </form>
      <Button onClick={effects._resetForm}>
        <IntlMessage id='reset' />
      </Button>
    </>
  )
)

export default AddNetwork
