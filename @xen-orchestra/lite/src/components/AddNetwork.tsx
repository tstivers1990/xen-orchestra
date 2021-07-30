import React, { FormEventHandler } from 'react'
import { Map } from 'immutable'
import { withState } from 'reaclette'

import Button from './Button'
import Input from './Input'
import IntlMessage from './IntlMessage'
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
}

interface Props {}

interface ParentEffects {}

interface Effects {
  _newNetwork: FormEventHandler<HTMLFormElement>
  _resetForm: () => void
  _toggleBonded: () => void
}

interface Computed {
  pifs?: Map<string, Pif>
  pifsMetrics?: Map<string, PifMetrics>
}

const BOND_MODE = ['balance-slb', 'active-backup', 'lacp']

const AddNetwork = withState<State, Props, Effects, Computed, ParentState, ParentEffects>(
  {
    initialState: () => ({
      formRef: React.createRef(),
      isBonded: false,
    }),
    computed: {
      pifs: state => state.objectsByType.get('PIF'),
      pifsMetrics: state => state.objectsByType.get('PIF_metrics'),
    },
    effects: {
      _newNetwork: async function (e) {
        e.preventDefault()
        const { current } = this.state.formRef
        const bondMode = current?.bondMode?.value
        const desc: string = current?.desc.value || 'Created with Xen Orchestra Lite'
        const mtu = +current?.mtu.value || 1500
        const name: string | undefined = current?.networkName.value
        const pifsRef: string | string[] | undefined = this.state.isBonded
          ? Array.from<HTMLOptionElement>(current?.pif.selectedOptions).map(({ value }) => value)
          : current?.pif.value
        const vlan = +current?.vlan?.value || 0

        let networkRef: string | undefined
        try {
          networkRef = (await this.state.xapi.call('network.create', {
            name_label: name,
            name_description: desc,
            other_config: { automatic: 'false' },
            MTU: mtu,
            VLAN: vlan,
          })) as string

          if (this.state.isBonded && Array.isArray(pifsRef)) {
            const pifsRefList = pifsRef.map(pifsRef =>
              this.state.pifs?.find(pif => pif.$ref === pifsRef)?.$network.$PIFs.map(pif => pif.$ref)
            )
            await Promise.all(
              pifsRefList.map(pifs => this.state.xapi.call('Bond.create', networkRef, pifs, '', bondMode))
            )
          }

          if (typeof pifsRef === 'string' && pifsRef !== '') {
            await this.state.xapi.call('pool.create_VLAN_from_PIF', pifsRef, networkRef, vlan)
          }
          this.effects._resetForm()
        } catch (error) {
          alert({ message: <p>{error.message}</p>, title: <p>Network creation</p> })
          console.error(error)
          if (networkRef !== undefined) {
            console.log(networkRef)
            await this.state.xapi.call('network.destroy', networkRef)
          }
          return
        }
      },
      _resetForm: function () {
        this.state.formRef.current?.reset()
      },
      _toggleBonded: function () {
        this.state.isBonded = !this.state.isBonded
      },
    },
  },
  ({ effects, state }) => (
    <>
      <form onSubmit={effects._newNetwork} ref={state.formRef}>
        <div>
          <label>
            <IntlMessage id='bondedNetwork' />
          </label>
          <Input type='checkbox' name='bonded' checked={state.isBonded} onChange={effects._toggleBonded} />
        </div>
        <div>
          <label>
            <IntlMessage id='interface' />
          </label>
          <select name='pif' multiple={state.isBonded} required={state.isBonded}>
            {!state.isBonded && (
              <IntlMessage id='selectPif'>
                {message => (
                  <option selected value=''>
                    {message}
                  </option>
                )}
              </IntlMessage>
            )}
            {state.pifs
              ?.filter(
                pif => pif.VLAN === -1 && pif.bond_slave_of === 'OpaqueRef:NULL' && pif.host === pif.$pool.master
              )
              .sortBy(pif => pif.device)
              .map(pif => (
                <option key={pif.$id} value={pif.$ref}>
                  {`${pif.device} (${
                    state.pifsMetrics?.find(metrics => metrics.$ref === pif.metrics)?.device_name ?? 'unknown'
                  })`}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label>
            <IntlMessage id='name' />
          </label>
          <Input type='text' name='networkName' />
        </div>
        <div>
          <label>
            <IntlMessage id='description' />
          </label>
          <Input type='text' name='desc' />
        </div>
        <div>
          <label>
            <IntlMessage id='mtu' />
          </label>
          <Input type='number' placeholder='Default: 1500' name='mtu' />
        </div>
        {state.isBonded ? (
          <div>
            <label>
              <IntlMessage id='bondMode' />
            </label>
            <select name='bondMode'>
              <IntlMessage id='selectBondMode'>
                {message => (
                  <option selected value=''>
                    {message}
                  </option>
                )}
              </IntlMessage>
              {BOND_MODE.map(mode => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label>
              <IntlMessage id='vlan' />
            </label>
            <Input type='number' placeholder='No VLAN if empty' name='vlan' />
          </div>
        )}
        <Button type='submit'>
          <IntlMessage id='send' />
        </Button>
      </form>
      <Button onClick={effects._resetForm}>
        <IntlMessage id='reset' />
      </Button>
    </>
  )
)

export default AddNetwork
