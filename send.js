const liquid = require('liquidjs-lib');
const axios = require('axios');

let coinSelect = require('./index')
// Current network
const network = liquid.networks.regtest;
// Nigiri Chopstick Liquid base URI 
const APIURL = `http://localhost:3001`

const LiquidBitcoinAsset = Buffer.concat([
  Buffer.from('01', 'hex'), //prefix for unconfidential asset
  Buffer.from(network.assetHash, 'hex').reverse(),
]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}





async function main() {
  // generate a keyPair importing from WIF
  const keyPair = liquid.ECPair.fromWIF(
    'cPNMJD4VyFnQjGbGs3kcydRzAbDCXrLAbvH6wTCqs88qg1SkZT3J',
    network,
  );
  const keyPair2 = liquid.ECPair.fromWIF(
    'cSv4PQtTpvYKHjfp9qih2RMeieBQAVADqc8JGXPvA7mkJ8yD5QC1',
    network,
  );

  // Get a random unconfidential liquid address to request funds
  const alice = liquid.payments.p2wpkh({ pubkey: keyPair.publicKey, network });
  const bob = liquid.payments.p2wpkh({ pubkey: keyPair2.publicKey, network });
  console.log(`Alice address ${alice.address}`);
  console.log(`Bob address ${bob.address}`);
  console.log(``);

  // Call the Faucet
  await faucet(alice.address);
  const utxos = await fetchUtxos(alice.address);

  let targets = [
    {
      nonce: Buffer.from('00', 'hex'),
      script: bob.output,
      value: 8000000,
      asset: LiquidBitcoinAsset
    }
  ]

  let { inputs, outputs, fee } = coinSelect(utxos, targets, 1)

  if (!inputs || !outputs)
    return console.log("No solution found");

  console.log(fee)


  // Now we can try to spend the fresh utxo
  const psbt = new liquid.Psbt();

  inputs.forEach(input => {
    psbt.addInput({
      // if hash is string, txid, if hash is Buffer, is reversed compared to txid
      hash: input.txid,
      index: input.vout,
      //The scriptPubkey and the value only are needed.
      witnessUtxo: {
        nonce: Buffer.from('00', 'hex'),
        script: alice.output,
        value: liquid.satoshiToConfidentialValue(input.value),
        asset: LiquidBitcoinAsset
      }
    })
  });


  outputs.forEach(output => {
    // watch out, outputs may have been added that you need to provide
    // an output address/script for

    if (!output.script) {
      output.script = alice.output
    } 

    psbt.addOutput({
      nonce: Buffer.from('00', 'hex'),
      script: output.script,
      value: liquid.satoshiToConfidentialValue(output.value),
      asset: LiquidBitcoinAsset,
    })

  });

  //Add explicit outpout fee
  psbt.addOutput({
    nonce: Buffer.from('00', 'hex'),
    script: Buffer.alloc(0),
    value: liquid.satoshiToConfidentialValue(fee),
    asset: LiquidBitcoinAsset,
  })





  // Let's sign the input 
  psbt.signAllInputs(keyPair);
  // finalize all inputs
  psbt.finalizeAllInputs();
  // Get the tx in hex format ready to be broadcasted
  const hex = psbt.extractTransaction().toHex();

  console.log('Signed transaction hex format')
  console.log(hex)
  console.log()
  console.log(psbt.toBase64())


}


async function faucet(address) {
  console.log('Requesting funds via faucet...')
  await axios.post(`${APIURL}/faucet`, { address });
  await sleep(500);
  console.log(`Done √ \n`);
}


async function fetchUtxos(address) {
  console.log(`Fetching utxos...`);
  const utxos = (await axios.get(`${APIURL}/address/${address}/utxo`)).data;
  await sleep(500);
  console.log(`Done √\n`)

  return utxos;
}



main()



