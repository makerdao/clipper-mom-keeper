# clipper-mom-keeper
This keeper checks the clipper-mom for each collateral type to see if it
can call the `tripBreaker()` call.  This check happens every new block.  If the
function can be called, it will execute the transaction and trip the breaker
for liquidations, thus preventing any liquidations for this collateral type.

The typical condition to trip the breaker is that the asset price has fallen
more than 50% in a one hour period.

## Install
npm install

## Make configuration changes
Simply edit index.js and change `WS_RPC` to your webocket URL.

## Run
npm start
