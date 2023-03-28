import type { Chain, Client, ConnectArgs, Connector } from '@wagmi/core'
import {
  connect,
  disconnect,
  fetchBalance,
  fetchEnsAvatar,
  fetchEnsName,
  getAccount,
  getNetwork,
  switchNetwork,
  watchAccount,
  watchNetwork
} from '@wagmi/core'
import type { ConnectorId, ModalConnectorsOpts } from './types'

export class EthereumClient {
  private readonly wagmi = {} as Client
  public walletConnectUri = ''
  public walletConnectVersion: ModalConnectorsOpts['version'] = 1
  public readonly chains = [] as Chain[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public constructor(wagmi: any, chains: Chain[]) {
    this.wagmi = wagmi
    this.chains = chains
    const { isV2 } = this.getWalletConnectConnectors()
    this.walletConnectVersion = isV2 ? 2 : 1
  }

  // -- private ------------------------------------------- //
  private getWalletConnectConnectors() {
    const wcc = this.wagmi.connectors.find((c: Connector) => c.id === 'walletConnect')
    const wc1c = this.wagmi.connectors.find((c: Connector) => c.id === 'walletConnectLegacy')
    const connector = wcc ?? wc1c
    if (!connector) {
      throw new Error('WalletConnectConnector or WalletConnectLegacyConnector is required')
    }

    return { isV2: Boolean(wcc), connector }
  }

  private async connectWalletConnectV1(connector: Connector, onUri: (uri: string) => void) {
    return new Promise<void>((resolve, reject) => {
      connector.once('message', async ({ type }) => {
        if (type === 'connecting') {
          const providerConnector = (await connector.getProvider()).connector
          this.walletConnectUri = providerConnector.uri
          onUri(providerConnector.uri)
          providerConnector.on('disconnect', () => {
            reject(Error())
          })
          providerConnector.on('connect', () => {
            resolve()
          })
        }
      })
    })
  }

  private async connectWalletConnectV2(connector: Connector, onUri: (uri: string) => void) {
    return new Promise<void>(resolve => {
      connector.on('message', ({ type, data }) => {
        if (type === 'display_uri') {
          onUri(data as string)
        }
      })
      connector.on('connect', () => resolve())
    })
  }

  // -- public web3modal ---------------------------------- //
  public namespace = 'eip155'

  public getConnectorById(id: ConnectorId | string) {
    const connector = this.wagmi.connectors.find(item => item.id === id)
    if (!connector) {
      throw new Error(`Connector for id ${id} was not found`)
    }

    return connector
  }

  public getConnectors() {
    const connectors = this.wagmi.connectors.filter(
      connector => !connector.id.includes('walletConnect')
    )

    return connectors
  }

  public async connectWalletConnect(onUri: (uri: string) => void, chainId?: number) {
    const { connector, isV2 } = this.getWalletConnectConnectors()
    const options: ConnectArgs = { connector }
    if (chainId) {
      options.chainId = chainId
    }
    const handleProviderEvents = isV2
      ? this.connectWalletConnectV2.bind(this)
      : this.connectWalletConnectV1.bind(this)
    const [data] = await Promise.all([connect(options), handleProviderEvents(connector, onUri)])

    return data
  }

  public async connectConnector(connectorId: ConnectorId | string, chainId?: number) {
    const connector = this.getConnectorById(connectorId)
    const options: ConnectArgs = { connector }
    if (chainId) {
      options.chainId = chainId
    }
    const data = await connect(options)

    return data
  }

  public async reconnectWalletConnect() {
    const { connector, isV2 } = this.getWalletConnectConnectors()
    if (isV2) {
      console.log('halloooo')
      const provider = await connector.getProvider()
      provider.signer.client.core.relayer.transportOpen()
    }
  }

  public disconnect = disconnect

  public getAccount = getAccount

  public watchAccount = watchAccount

  public fetchBalance = fetchBalance

  public getNetwork = getNetwork

  public watchNetwork = watchNetwork

  public switchNetwork = switchNetwork

  // -- public web3modal (optional) ----------------------- //
  public fetchEnsName = fetchEnsName

  public fetchEnsAvatar = fetchEnsAvatar
}
