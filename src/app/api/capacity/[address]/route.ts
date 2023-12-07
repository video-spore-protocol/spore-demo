import { BI, Indexer, helpers } from '@ckb-lumos/lumos';
import { predefinedSporeConfigs } from '@spore-sdk/core';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { address: string } }) {
  const { address } = params;
  if (!address) {
    return new Response(null, { status: 400 });
  }

  const config = predefinedSporeConfigs.Aggron4;
  const indexer = new Indexer(config.ckbIndexerUrl);
  const collector = indexer.collector({
    lock: helpers.parseAddress(address as string, { config: config.lumos }),
    data: '0x',
  });

  let capacities = BI.from(0);
  for await (const cell of collector.collect()) {
    capacities = capacities.add(cell.cellOutput.capacity);
  }

  return new Response(capacities.toHexString(), { status: 200 });
}
