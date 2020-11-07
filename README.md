This is a node.js wrapper for the Coinfloor websocket [API](https://github.com/coinfloor/API/blob/master/WEBSOCKET-README.md).

It implements all the functions of the API.
It is a simple wrapper, so everything should work as documented in the Coinfloor documentation, including the scaling factors for prices and quantities.

This package was not written by the Coinfloor exchange, so please do not contact them in relation to support for this package.

### Install

`npm install coinfloor`

### Example

```js
var Coinfloor = require('coinfloor');

var coinfloor = new Coinfloor(userID, password, api_key, onConnect);

//the onConnect function is called when successfully authenticated
function onConnect(){
  coinfloor.watchTicker(63488, 64032, true, function(msg){console.log(msg)});

  coinfloor.getBalances(function(msg){console.log(msg)})
};

coinfloor.addEventListener("TickerChanged", function(msg){
  console.log("new ticker:");
  console.log(msg);
});
```
For a more detailed example see the example folder.

## Functions

`addEventListener(notice, handler)`

`getBalances(callback)`

`getOrders(callback)`

`estimateBaseMarketOrder(base, counter, quantity, callback)`

`estimateCounterMarketOrder(base, counter, total, callback)`

`placeLimitOrder(base, counter, quantity, price, callback)`

`executeBaseMarketOrder(base, counter, quantity, callback)`

`executeCounterMarketOrder(base, counter, total, callback)`

`cancelOrder(id, callback)`

`cancelAllOrders(callback)`

`getTradeVolume(asset, callback)`

`watchOrders(base, counter, watch, callback)`

`watchTicker(base, counter, watch, callback)`
