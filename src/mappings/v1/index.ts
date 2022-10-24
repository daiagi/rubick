import {
  CollectionEntity, NFTEntity
} from '../../model/generated'

import { plsBe, real } from '@kodadot1/metasquid/dist/consolidator'
import { isRemark, unwrapRemark } from '@kodadot1/minimark'
import md5 from 'md5'
import { SystemRemarkCall } from '../../types/calls'
import { unwrap } from '../utils'
import { updateCache } from '../utils/cache'
import { isOwnerOrElseError } from '../utils/consolidator'

import { burn as consume, buy, changeIssuer, createCollection, createEvent, emote, handleMetadata, list, send } from '../shared'
import { create, get } from '../utils/entity'
import { getCreateToken } from '../utils/getters'
import { ensure } from '../utils/helper'
import logger, { logError } from '../utils/logger'
import {
  Context, getNftId, NFT,
  Optional,
  RmrkEvent,
  RmrkInteraction
} from '../utils/types'


export async function handleRemark(context: Context): Promise<void> {
  const { remark } = new SystemRemarkCall(context).asV1020
  const value = remark.toString()

  if (isRemark(value)) {
    await mainFrame(remark.toString(), context)
  } else {
    logger.warn(`[NON RMRK VALUE] ${value}`)
  }
}

export async function mainFrame(remark: string, context: Context): Promise<void> {
    const base = unwrap(context, (_: Context) => ({ value: remark }))
    try {
      const { interaction: event, version } = unwrapRemark<RmrkInteraction>(remark.toString())
      logger.pending(`[${event === RmrkEvent.MINT ? 'COLLECTION' : event}]: ${base.blockNumber}`)

      if (version === '2.0.0') {
        logger.star(`[RMRK::2.0.0] is not supported, please help us to make it awesome ${remark}`)
        return;
      }

      switch (event) {
        case RmrkEvent.MINT:
          await createCollection(context)
          break
        case RmrkEvent.MINTNFT:
          await mintNFT(context)
          break
        case RmrkEvent.SEND:
          await send(context)
          break
        case RmrkEvent.BUY:
          await buy(context)
          break
        case RmrkEvent.CONSUME:
          await consume(context)
          break
        case RmrkEvent.LIST:
          await list(context)
          break
        case RmrkEvent.CHANGEISSUER:
          await changeIssuer(context)
          break
        case RmrkEvent.EMOTE:
          await emote(context)
          break
        default:
          logger.start(
            `[SKIP] ${event}::${base.value}::${base.blockNumber}`
          )
      }
      await updateCache(base.timestamp,context.store)
    } catch (e) {
      logger.warn(
        `[MALFORMED]
         [BLOCK] ${base.blockNumber}
         [ERROR] ${(e as Error).message}
         [RMRK] ${base.value}`
      )
    }
  }


async function mintNFT(
  context: Context
): Promise<void> {
  let nft: Optional<NFT> = null
  try {
    const { value, caller, timestamp, blockNumber } = unwrap(context, getCreateToken);
    nft = value
    plsBe(real, nft.collection)
    const collection = ensure<CollectionEntity>(
      await get<CollectionEntity>(context.store, CollectionEntity, nft.collection)
    )
    plsBe(real, collection)
    isOwnerOrElseError(collection, caller)
    const id = getNftId(nft, blockNumber)
    // const entity = await get<NFTEntity>(context.store, NFTEntity, id) // TODO: check if exists
    // plsNotBe<NFTEntity>(real, entity as NFTEntity)
    const final = create<NFTEntity>(NFTEntity, id, {})
    final.id = id
    final.hash = md5(id)
    final.issuer = caller
    final.currentOwner = caller
    final.blockNumber = BigInt(blockNumber)
    final.name = nft.name
    final.instance = nft.instance
    final.transferable = nft.transferable
    final.collection = collection
    final.sn = nft.sn
    final.metadata = nft.metadata
    final.price = BigInt(0)
    final.burned = false
    final.createdAt = timestamp
    final.updatedAt = timestamp

    if (final.metadata) {
      const metadata = await handleMetadata(final.metadata, final.name, context.store)
      final.meta = metadata
    }

    logger.success(`[MINT] ${final.id}`)
    await context.store.save(final)
    await createEvent(final, RmrkEvent.MINTNFT, { blockNumber, caller, timestamp }, '', context.store)

  } catch (e) {
    logError(e, (e) =>
      logger.error(`[MINT] ${e.message}, ${JSON.stringify(nft)}`)
    )
  }
}


