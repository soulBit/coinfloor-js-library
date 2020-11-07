(function() {
	var ecp = require('./ecp.js');
	var btoa = require('btoa');
	var atob = require('atob');

	var url = "wss://api.coinfloor.co.uk/";

	var ws = new WebSocket(url);

	var _event_handlers = Object();
	var _tag = 1;
	var _result_handlers = Object();
	var _idle_ping_timer_id = null;

	module.exports = Coinfloor = (function(){
		function Coinfloor(user_id, password, api_key, onConnect, onClose, onError){
			this.user_id = user_id;
			this.password = password;
			this.api_key = api_key;

			/*
			 * add authentication function to event handlers
			 */
			_event_handlers["Welcome"] =  function(msg){
				console.log("Authenticating");
				authenticate(user_id, password, api_key, msg.nonce, function(){
					onConnect();
				});
			};

			/*
			 * set up websocket connection
			 */
			ws.on('open', function(data){
				console.log('websocket connected to: ' + url);
			});

			/*
			 * On each message call the relevant event handler
			 */
			ws.on('message', function (data, flags) {
				var msg = JSON.parse(data);
				if(msg !== undefined){
					console.log("\nReceived Message:")
					if(msg.error_code !== undefined && msg.error_code > 0){
						console.log('error: ');
						console.log( msg );
					} else {
						//call result handler function based on tag
						if(msg.tag !== undefined){
							handleResult(msg);
						}

						//call event handler function if this is a notification
						if(msg.notice !== undefined){
							handleNotification(msg);
						}
					}
				}
			});

			ws.on('close', function(code, reason) {
				if (onClose) {
					onClose(code, reason);
				}
			});
	
			ws.on('error', function(error, code) {
				if (onError) {
					onError(error, code);
				}
			});	
		}


		function _do_request(request, callback){
			console.log("\nSending Request:")
			console.log(request);
			var tag = request.tag;
			ws.send(JSON.stringify(request), function(err){ if(err) throw(err); });
			_result_handlers[tag] = callback;
			_reset_idle_ping_timer();
			_tag++;
		};

		function _reset_idle_ping_timer() {
			if (_idle_ping_timer_id) {
				clearTimeout(_idle_ping_timer_id);
			}
			_idle_ping_timer_id = setTimeout(function () {
				console.log("\nSending ping request to keep connection open");
				_do_request({ }, function () { });
			}, 45000);
		};

		function handleNotification(msg){
			var handler = _event_handlers[msg.notice];
			if(handler !== undefined){
				handler(msg);
			} else {
				console.log("No handler function for event: '" + msg.notice + "'");
			}
		}

		function handleResult(msg){
			var handler = _result_handlers[msg.tag];
			if(handler !== undefined && typeof(handler) === "function"){
				handler(msg);
				delete _result_handlers[msg.tag];
			}
		}

		/*
		 * Authenticates as the specified user with the given authentication cookie
		 * and passphrase.
		 */
		function authenticate(user_id, password, cookie, server_nonce, callback) {
			var packed_user_id = String.fromCharCode(0, 0, 0, 0, user_id >> 24 & 0xFF, user_id >> 16 & 0xFF, user_id >> 8 & 0xFF, user_id & 0xFF);

			var password

			//generate random client nonce
			var client_nonce = "";
			for (var i = 0; i < 16; ++i) {
				client_nonce += String.fromCharCode(Math.random() * 256);
			}

			//generate msg to sign with private key
			var msg = packed_user_id + atob(server_nonce) + client_nonce;

			//generate private key content to be hashed from the password and packed user id
			var privateKeySeed = packed_user_id + unescape(encodeURIComponent(password));

			// generate signature: sign the digest with the private key
			var signature = ecp.signECDSA(msg, privateKeySeed);

			var request = {
				  "tag": _tag,
					"method": "Authenticate",
					"user_id": Number(user_id),
					"cookie": cookie,
					"nonce": btoa(client_nonce),
					"signature": [ btoa(signature.r), btoa(signature.s)]
			};

			_do_request(request, function(result){
				console.log("Successfully authenticated user: " + user_id);
				callback(result);
			});
		};

		/*
		* add a listener for a message notice, to be called when this
		* message is received
		*/
		Coinfloor.prototype.addEventListener = function(notice, handler){
			_event_handlers[notice] = handler;
		}

		/*
		 * Retrieves all available balances of the authenticated user.
		 */
		Coinfloor.prototype.getBalances = function (callback) {
			_do_request({
				tag: _tag,
				method: "GetBalances"
			}, callback);
		},

		/*
		 * Retrieves all open orders of the authenticated user.
		 */
		Coinfloor.prototype.getOrders = function (callback) {
			_do_request({
				tag: _tag,
				method: "GetOrders"
			}, callback);
		};

		/*
		 * Estimates the total (in units of the counter asset) for a market order
		 * trading the specified quantity (in units of the base asset). The
		 * quantity should be positive for a buy order or negative for a sell
		 * order.
		 */
		Coinfloor.prototype.estimateBaseMarketOrder = function (base, counter, quantity, callback) {
			_do_request({
				tag: _tag,
				method: "EstimateMarketOrder",
				base: base,
				counter: counter,
				quantity: quantity
			}, callback);
		};

		/*
		 * Estimates the quantity (in units of the base asset) for a market order
		 * trading the specified total (in units of the counter asset). The total
		 * should be positive for a buy order or negative for a sell order.
		 */
		Coinfloor.prototype.estimateCounterMarketOrder = function (base, counter, total, callback) {
			_do_request({
				tag: _tag,
				method: "EstimateMarketOrder",
				base: base,
				counter: counter,
				total: total
			}, callback);
		};

		/*
		 * Places a limit order to trade the specified quantity (in units of the
		 * base asset) at the specified price or better. The quantity should be
		 * positive for a buy order or negative for a sell order. The price should
		 * be pre-multiplied by 10000.
		 */
		Coinfloor.prototype.placeLimitOrder = function (base, counter, quantity, price, callback) {
			_do_request({
				tag: _tag,
				method: "PlaceOrder",
				base: base,
				counter: counter,
				quantity: quantity,
				price: price
			}, callback);
		};

		/*
		 * Executes a market order to trade up to the specified quantity (in units
		 * of the base asset). The quantity should be positive for a buy order or
		 * negative for a sell order.
		 */
		Coinfloor.prototype.executeBaseMarketOrder = function (base, counter, quantity, callback) {
			_do_request({
				tag: _tag,
				method: "PlaceOrder",
				base: base,
				counter: counter,
				quantity: quantity
			}, callback);
		};

		/*
		 * Executes a market order to trade up to the specified total (in units of
		 * the counter asset). The total should be positive for a buy order or
		 * negative for a sell order.
		 */
		Coinfloor.prototype.executeCounterMarketOrder = function (base, counter, total, callback) {
			_do_request({
				tag: _tag,
				method: "PlaceOrder",
				base: base,
				counter: counter,
				total: total
			}, callback);
		},

		/*
		 * Cancels the specified open order.
		 */
		Coinfloor.prototype.cancelOrder = function (id, callback) {
			_do_request({
				tag: _tag,
				method: "CancelOrder",
				id: id
			}, callback);
		};

		/*
		 * Cancels all open orders belonging to the authenticated user.
		 */
		Coinfloor.prototype.cancelAllOrders = function (callback) {
			_do_request({
				tag: _tag,
				method: "CancelAllOrders",
			}, callback);
		};		

		/*
		 * Retrieves the trailing 30-day trading volume of the authenticated user
		 * in the specified asset.
		 */
		Coinfloor.prototype.getTradeVolume = function (asset, callback) {
			_do_request({
				tag: _tag,
				method: "GetTradeVolume",
				asset: asset
			}, callback);
		};

		/*
		 * Subscribes to (or unsubscribes from) the orders feed of the specified
		 * order book. Subscribing to feeds does not require authentication.
		 */
		Coinfloor.prototype.watchOrders =  function (base, counter, watch, callback) {
			_do_request({
				tag: _tag,
				method: "WatchOrders",
				base: base,
				counter: counter,
				watch: watch
			}, callback);
		};

		/*
		 * Subscribes to (or unsubscribes from) the ticker feed of the specified
		 * order book. Subscribing to feeds does not require authentication.
		 */
		Coinfloor.prototype.watchTicker = function (base, counter, watch, callback) {
			_do_request({
				tag: _tag,
				method: "WatchTicker",
				base: base,
				counter: counter,
				watch: watch
			}, callback);
		};

		return Coinfloor;

	})();

}).call(this);
