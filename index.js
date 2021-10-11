const fs = require('fs');
const fetch = require('node-fetch');
const ethers = require("ethers");

// configuration
// const WS_RPC              = 'http://127.0.0.1:8545/';
const WS_RPC              = 'ws://192.168.1.111:8546/';
const CHAINLOG            = "0xdA0Ab1e0017DEbCd72Be8599041a2aa3bA7e740F";
const MAX_GAS_LIMIT       = ethers.utils.parseUnits('10000000', 'wei');
const GAS_BUMP            = ethers.utils.parseUnits('200000', 'wei');

//
// DO NOT CHANGE BELOW LINE
//

// math
const BIL = ethers.BigNumber.from("10").pow(9);

// block mutex
let onBlockMutex = false;

// wallet
// const provider = new ethers.providers.JsonRpcProvider(WS_RPC);
const provider = new ethers.providers.WebSocketProvider(WS_RPC);
const privateKey = fs.readFileSync('./secrets/private.key');
const signer = new ethers.Wallet(privateKey.toString('utf8'), provider);

// contracts
const chainLogABI = JSON.parse(fs.readFileSync('./abi/ChainLog.abi').toString());
const chainlog = new ethers.Contract(CHAINLOG, chainLogABI, signer);

const clipperMomABI = JSON.parse(fs.readFileSync('./abi/ClipperMom.abi').toString());

async function checkClipperMom(clipperMom, _overrides) {
  const entries = await chainlog.count();

  for (let i = 0; entries.gt(i); i++) {
    let key = ethers.utils.parseBytes32String(await chainlog.keys(i));

    if (key.match(/MCD_CLIP/) && !key.match(/MCD_CLIP_CALC/)) {
      let clipperAddress = await chainlog.getAddress(ethers.utils.formatBytes32String(key));

      try {
        _overrides.gasLimit = await clipperMom.estimateGas.tripBreaker(
          clipperAddress, _overrides
        );

        if (_overrides.gasLimit.gt(MAX_GAS_LIMIT)) {
          console.log(
            'checkClipperMom: gasLimit too high: ' +
              _overrides.gasLimit + ' > ' + MAX_GAS_LIMIT
          );
          continue;
        }

        // dry run, if this would error, we would go to catch block
        await clipperMom.callStatic.tripBreaker(clipperAddress, _overrides);

        // everything beyond here is a real call
        console.log(
          'checkClipperMom: clipperMom.tripBreaker(' + clipperAddress + ') ' +
          'for ' + key
        );
        const tx = await clipperMom.tripBreaker(clipperAddress, _overrides);
        console.log(tx);
        const receipt = await tx.wait();
        console.log(receipt);
      } catch (err) {
        // standard path lands here, uncomment to debug
        // console.error(err);
        continue;
      }
    }
  }
}

async function onBlock(blockNumber) {
  console.log('onBlock: block number ' + blockNumber);

  if (onBlockMutex) {
    console.log('onBlock: already processing a block, exiting...');
    return;
  }

  provider.off("block");
  onBlockMutex = true;

  const clipperMomAddress = await chainlog.getAddress(
    ethers.utils.formatBytes32String('CLIPPER_MOM')
  );
  const clipperMom = new ethers.Contract(
    clipperMomAddress, clipperMomABI, signer
  );

  // debugging gas price
  //
  // let fee = await provider.getFeeData()
  // console.log(
  //   'gasPrice: ' + ethers.utils.formatUnits(fee.gasPrice, "gwei")
  // );
  // console.log(
  //   'maxFeePerGas: ' + ethers.utils.formatUnits(fee.maxFeePerGas, "gwei")
  // );
  // console.log(
  //   'maxPriorityFeePerGas: ' + ethers.utils.formatUnits(fee.maxPriorityFeePerGas, "gwei")
  // );

  // All overrides are optional
  let overrides = {
      gasLimit: GAS_BUMP.mul(5)
  };

  await checkClipperMom(clipperMom, overrides);

  onBlockMutex = false;
  return provider.on("block", onBlock);
}

provider.on("block", onBlock);
