'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { ExchangeError, ExchangeNotAvailable, AuthenticationError, InvalidOrder, InsufficientFunds, OrderNotFound, DDoSProtection, PermissionDenied, AddressPending } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class bittrex extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'uex',
            'name': 'UEX',
            'countries': [ 'SG', 'US' ],
            'version': 'v1.0.3',
            'rateLimit': 1500,
            'certified': true,
            // new metainfo interface
            'has': {
                'CORS': true,
                'createMarketOrder': false,
                'fetchDepositAddress': true,
                'fetchClosedOrders': true,
                'fetchMyTrades': true,
                'fetchOHLCV': true,
                'fetchOrder': true,
                'fetchOpenOrders': true,
                'withdraw': true,
            },
            'timeframes': {
                '1m': '1',
                '5m': '5',
                '15m': '15m',
                '30m': '30',
                '1h': '60',
                '2h': '120',
                '3h': '180',
                '4h': '240',
                '6h': '360',
                '12h': '720',
                '1d': '1440',
            },
            'urls': {
                'logo': 'https://user-images.githubusercontent.com/1294454/27766352-cf0b3c26-5ed5-11e7-82b7-f3826b7a97d8.jpg',
                'api': 'https://open-api.uex.com/open/api',
                'www': 'https://www.uex.com',
                'doc': 'https://download.uex.com/doc/UEX-API-English-1.0.3.pdf',
                'fees': 'https://www.uex.com/footer/ufees.html',
                'referral': 'https://www.uex.com/signup.html?code=VAGQLL',
            },
            'api': {
                'public': {
                    'get': [
                        'common/symbols',
                        'get_records', // ohlcvs
                        'get_ticker',
                        'get_trades',
                        'market_dept', // dept here is not a typo... they mean depth
                    ],
                },
                'private': {
                    'get': [
                        'user/account',
                        'market', // Docs: Get the latest transaction price of each currency pair (??)
                        'order_info',
                        'new_order', // open orders
                        'all_order',
                        'all_trade',
                    ],
                    'post': [
                        'create_order',
                        'cancel_order',
                    ],
                },
            },
            'fees': {
                'trading': {
                    'tierBased': false,
                    'percentage': true,
                    'maker': 0.0025,
                    'taker': 0.0025,
                },
            },
            'exceptions': {
                // descriptions from ↓ exchange
                // '0': 'no error', // succeed
                '4': InsufficientFunds, // {"code":"4","msg":"余额不足:0E-16","data":null}
                '5': ExchangeError, // fail to order
                '6': InvalidOrder, // the quantity value less than the minimum one
                '7': InvalidOrder, // the quantity value more than the maximum one
                '8': ExchangeError, // fail to cancel order
                '9': ExchangeError, // transaction be frozen
                '13': ExchangeError, // Sorry, the program made an error, please contact with the manager.
                '19': InsufficientFunds, // Available balance is insufficient.
                '22': OrderNotFound, // The order does not exist.
                '23': InvalidOrder, // Lack of parameters of numbers of transaction
                '24': InvalidOrder, // Lack of parameters of transaction price
                '100001': ExchangeError, // System is abnormal
                '100002': ExchangeNotAvailable, // Update System
                '100004': ExchangeError, // {"code":"100004","msg":"request parameter illegal","data":null}
                '100005': AuthenticationError, // {"code":"100005","msg":"request sign illegal","data":null}
                '100007': PermissionDenied, // illegal IP
                '110002': ExchangeError, // unknown currency code
                '110003': AuthenticationError, // fund password error
                '110004': AuthenticationError, // fund password error
                '110005': InsufficientFunds, // Available balance is insufficient.
                '110020': AuthenticationError, // Username does not exist.
                '110023': AuthenticationError, // Phone number is registered.
                '110024': AuthenticationError, // Email box is registered.
                '110025': PermissionDenied, // Account is locked by background manager
                '110032': PermissionDenied, // The user has no authority to do this operation.
                '110033': ExchangeError, // fail to recharge
                '110034': ExchangeError, // fail to withdraw
                '-100': ExchangeError, // {"code":"-100","msg":"Your request path is not exist or you can try method GET/POST.","data":null}
            },
            'requiredCredentials': {
                'apiKey': true,
                'secret': true,
                'password': true,
                'countryCode': true,
                'phoneNumber': true,
            },
            'options': {
                'createMarketBuyOrderRequiresPrice': true,
            },
        });
    }

    async fetchMarkets () {
        let response = await this.publicGetCommonSymbols ();
        //
        //     { code:   "0",
        //        msg:   "suc",
        //       data: [ {           symbol: "btcusdt",
        //                       count_coin: "usdt",
        //                 amount_precision:  3,
        //                        base_coin: "btc",
        //                  price_precision:  2         },
        //               {           symbol: "ethusdt",
        //                       count_coin: "usdt",
        //                 amount_precision:  3,
        //                        base_coin: "eth",
        //                  price_precision:  2         },
        //               {           symbol: "ethbtc",
        //                       count_coin: "btc",
        //                 amount_precision:  3,
        //                        base_coin: "eth",
        //                  price_precision:  6        },
        //
        let result = [];
        let markets = response['data'];
        for (let i = 0; i < markets.length; i++) {
            let market = markets[i];
            let id = market['symbol'];
            let baseId = market['base_coin'];
            let quoteId = market['count_coin'];
            let base = baseId.toUpperCase ();
            let quote = quoteId.toUpperCase ();
            base = this.commonCurrencyCode (base);
            quote = this.commonCurrencyCode (quote);
            let symbol = base + '/' + quote;
            let precision = {
                'amount': market['amount_precision'],
                'price': market['price_precision'],
            };
            let active = true;
            result.push ({
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'active': active,
                'info': market,
                'precision': precision,
                'limits': {
                    'amount': {
                        'min': undefined,
                        'max': undefined,
                    },
                    'price': {
                        'min': undefined,
                        'max': undefined,
                    },
                    'cost': {
                        'min': undefined,
                        'max': undefined,
                    },
                },
            });
        }
        return result;
    }

    async fetchBalance (params = {}) {
        await this.loadMarkets ();
        let response = await this.privateGetUserAccount (params);
        //
        //     { code:   "0",
        //        msg:   "suc",
        //       data: { total_asset:   "0.00000000",
        //                 coin_list: [ {      normal: "0.00000000",
        //                                btcValuatin: "0.00000000",
        //                                     locked: "0.00000000",
        //                                       coin: "usdt"        },
        //                              {      normal: "0.00000000",
        //                                btcValuatin: "0.00000000",
        //                                     locked: "0.00000000",
        //                                       coin: "btc"         },
        //                              {      normal: "0.00000000",
        //                                btcValuatin: "0.00000000",
        //                                     locked: "0.00000000",
        //                                       coin: "eth"         },
        //                              {      normal: "0.00000000",
        //                                btcValuatin: "0.00000000",
        //                                     locked: "0.00000000",
        //                                       coin: "ren"         },
        //
        let balances = response['data']['coin_list'];
        let result = { 'info': balances };
        for (let i = 0; i < balances.length; i++) {
            let balance = balances[i];
            let currencyId = balance['coin'];
            let code = currencyId.toUpperCase ();
            if (currencyId in this.currencies_by_id) {
                code = this.currencies_by_id[currencyId]['code'];
            } else {
                code = this.commonCurrencyCode (code);
            }
            let account = this.account ();
            let free = parseFloat (balance['normal']);
            let used = parseFloat (balance['locked']);
            let total = this.sum (free, used);
            account['free'] = free;
            account['used'] = used;
            account['total'] = total;
            result[code] = account;
        }
        return this.parseBalance (result);
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let response = await this.publicGetMarketDept (this.extend ({
            'symbol': this.marketId (symbol),
            'type': 'step0', // step1, step2 from most detailed to least detailed
        }, params));
        //
        //     { code:   "0",
        //        msg:   "suc",
        //       data: { tick: { asks: [ ["0.05824200", 9.77],
        //                               ["0.05830000", 7.81],
        //                               ["0.05832900", 8.59],
        //                               ["0.10000000", 0.001]  ],
        //                       bids: [ ["0.05780000", 8.25],
        //                               ["0.05775000", 8.12],
        //                               ["0.05773200", 8.57],
        //                               ["0.00010000", 0.79]   ],
        //                       time:    1533412622463            } } }
        //
        return this.parseOrderBook (response['data']['tick'], response['data']['time']);
    }

    parseTicker (ticker, market = undefined) {
        //
        //     { code:   "0",
        //        msg:   "suc",
        //       data: { symbol: "ETHBTC",
        //                 high:  0.058426,
        //                  vol:  19055.875,
        //                 last:  0.058019,
        //                  low:  0.055802,
        //               change:  0.03437271,
        //                  buy: "0.05780000",
        //                 sell: "0.05824200",
        //                 time:  1533413083184 } }
        //
        let timestamp = this.safeInteger (ticker, 'time');
        let symbol = undefined;
        if (typeof market === 'undefined') {
            let marketId = this.safeString (ticker, 'symbol');
            marketId = marketId.toLowerCase ();
            if (marketId in this.markets_by_id) {
                market = this.markets_by_id[marketId];
            }
        }
        if (typeof market !== 'undefined') {
            symbol = market['symbol'];
        }
        let last = this.safeFloat (ticker, 'last');
        let change = this.safeFloat (ticker, 'change');
        let percentage = change * 100;
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'high': this.safeFloat (ticker, 'high'),
            'low': this.safeFloat (ticker, 'low'),
            'bid': this.safeFloat (ticker, 'buy'),
            'bidVolume': undefined,
            'ask': this.safeFloat (ticker, 'sell'),
            'askVolume': undefined,
            'vwap': undefined,
            'open': undefined,
            'close': last,
            'last': last,
            'previousClose': undefined,
            'change': undefined,
            'percentage': percentage,
            'average': undefined,
            'baseVolume': this.safeFloat (ticker, 'vol'),
            'quoteVolume': undefined,
            'info': ticker,
        };
    }

    async fetchTicker (symbol, params = {}) {
        await this.loadMarkets ();
        let market = this.market (symbol);
        let response = await this.publicGetGetTicker (this.extend ({
            'symbol': market['id'],
        }, params));
        //
        //     { code:   "0",
        //        msg:   "suc",
        //       data: { symbol: "ETHBTC",
        //                 high:  0.058426,
        //                  vol:  19055.875,
        //                 last:  0.058019,
        //                  low:  0.055802,
        //               change:  0.03437271,
        //                  buy: "0.05780000",
        //                 sell: "0.05824200",
        //                 time:  1533413083184 } }
        //
        return this.parseTicker (response['data'], market);
    }

    parseTrade (trade, market = undefined) {
        //
        // public fetchTrades
        //
        //   {      amount:  0.88,
        //     create_time:  1533414358000,
        //           price:  0.058019,
        //              id:  406531,
        //            type: "sell"          },
        //
        // private fetchMyTrades
        //
        //     {     volume: "1.000",
        //             side: "BUY",
        //          feeCoin: "YLB",
        //            price: "0.10000000",
        //              fee: "0.16431104",
        //            ctime:  1510996571195,
        //       deal_price: "0.10000000",
        //               id:  306,
        //             type: "Buy-in"        }
        //
        let timestamp = this.safeInteger2 (trade, 'create_time', 'ctime');
        let side = this.safeString2 (trade, 'side', 'type');
        if (typeof side !== 'undefined') {
            side = side.toLowerCase ();
        }
        let id = this.safeString (trade, 'id');
        let symbol = undefined;
        if (typeof market !== 'undefined') {
            symbol = market['symbol'];
        }
        let price = this.safeFloat2 (trade, 'deal_price', 'price');
        let amount = this.safeFloat (trade, 'volume', 'amount');
        let cost = undefined;
        if (typeof amount !== 'undefined') {
            if (typeof price !== 'undefined') {
                cost = amount * price;
            }
        }
        let fee = undefined;
        let feeCost = this.safeFloat (trade, 'fee');
        if (typeof feeCost !== 'undefined') {
            let feeCurrency = this.safeString (trade, 'feeCoin');
            if (typeof feeCurrency !== 'undefined') {
                let currencyId = feeCurrency.toLowerCase ();
                if (currencyId in this.currencies_by_id) {
                    feeCurrency = this.currencies_by_id[currencyId]['code'];
                }
            }
            fee = {
                'cost': feeCost,
                'currency': feeCurrency,
            };
        }
        return {
            'id': id,
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': symbol,
            'type': undefined,
            'side': side,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': fee,
        };
    }

    async fetchTrades (symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let market = this.market (symbol);
        let response = await this.publicGetGetTrades (this.extend ({
            'symbol': market['id'],
        }, params));
        //
        //     { code:   "0",
        //        msg:   "suc",
        //       data: [ {      amount:  0.88,
        //                 create_time:  1533414358000,
        //                       price:  0.058019,
        //                          id:  406531,
        //                        type: "sell"          },
        //               {      amount:  4.88,
        //                 create_time:  1533414331000,
        //                       price:  0.058019,
        //                          id:  406530,
        //                        type: "buy"           },
        //               {      amount:  0.5,
        //                 create_time:  1533414311000,
        //                       price:  0.058019,
        //                          id:  406529,
        //                        type: "sell"          },
        //
        return this.parseTrades (response['data'], market, since, limit);
    }

    parseOHLCV (ohlcv, market = undefined, timeframe = '1d', since = undefined, limit = undefined) {
        return [
            ohlcv[0] * 1000, // timestamp
            ohlcv[1], // open
            ohlcv[2], // high
            ohlcv[3], // low
            ohlcv[4], // close
            ohlcv[5], // volume
        ];
    }

    async fetchOHLCV (symbol, timeframe = '1m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let market = this.market (symbol);
        let request = {
            'symbol': market['id'],
            'period': this.timeframes[timeframe], // in minutes
        };
        let response = await this.publicGetGetRecords (this.extend (request, params));
        //
        //     { code: '0',
        //        msg: 'suc',
        //       data:
        //        [ [ 1533402420, 0.057833, 0.057833, 0.057833, 0.057833, 18.1 ],
        //          [ 1533402480, 0.057833, 0.057833, 0.057833, 0.057833, 29.88 ],
        //          [ 1533402540, 0.057833, 0.057833, 0.057833, 0.057833, 29.06 ],
        //
        return this.parseOHLCVs (response['data'], market, timeframe, since, limit);
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let request = {};
        let market = undefined;
        if (typeof symbol !== 'undefined') {
            market = this.market (symbol);
            request['market'] = market['id'];
        }
        let response = await this.marketGetOpenorders (this.extend (request, params));
        let orders = this.parseOrders (response['result'], market, since, limit);
        return this.filterBySymbol (orders, symbol);
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        if (type === 'market') {
            // for market buy it requires the amount of quote currency to spend
            if (side === 'buy') {
                if (this.options['createMarketBuyOrderRequiresPrice']) {
                    if (typeof price === 'undefined') {
                        throw new InvalidOrder (this.id + " createOrder() requires the price argument with market buy orders to calculate total order cost (amount to spend), where cost = amount * price. Supply a price argument to createOrder() call if you want the cost to be calculated for you from price and amount, or, alternatively, add .options['createMarketBuyOrderRequiresPrice'] = false to supply the cost in the amount argument (the exchange-specific behaviour)");
                    } else {
                        amount = amount * price;
                    }
                }
            }
        }
        await this.loadMarkets ();
        let market = this.market (symbol);
        let orderType = (type === 'limit') ? '1' : '2';
        let orderSide = side.toUpperCase ();
        let request = {
            'side': orderSide,
            'type': orderType,
            'symbol': market['id'],
            'volume': this.amountToPrecision (symbol, amount),
            // An excerpt from their docs:
            // side required Trading Direction
            // type required pending order types，1:Limit-price Delegation 2:Market- price Delegation
            // volume required
            //     Purchase Quantity（polysemy，multiplex field）
            //     type=1: Quantity of buying and selling
            //     type=2: Buying represents gross price, and selling represents total number
            //     Trading restriction user/me-user information
            // price optional Delegation Price：type=2：this parameter is no use.
            // fee_is_user_exchange_coin optional
            //     0，when making transactions with all platform currencies,
            //     this parameter represents whether to use them to pay
            //     fees or not and 0 is no, 1 is yes.
        };
        if (type === 'limit') {
            request['price'] = this.priceToPrecision (symbol, price);
        }
        //
        // Fields Examples Explanations
        // code 0
        // msg "suc" code>0 failed
        // data {"order_id":34343} succeed to return transaction ID
        //
        let response = await this.privatePostCreateOrder (this.extend (request, params));
        const log = require ('ololog');
        log.unlimited (response);
        process.exit ();
        return this.parseOrder (response['data'], market);
        // let result = {
        //     'info': response,
        //     'id': response['result'][orderIdField],
        //     'symbol': symbol,
        //     'type': type,
        //     'side': side,
        //     'status': 'open',
        // };
        // return result;
    }

    async cancelOrder (id, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        let market = this.market (symbol);
        let request = {
            'order_id': id,
            'symbol': market['id'],
        };
        let response = await this.privatePostCancelOrder (this.extend (request, params));
        return this.extend (this.parseOrder (response), {
            'status': 'canceled',
        });
    }

    parseOrderStatus (status) {
        let statuses = {
            '0': 'open', // INIT(0,"primary order，untraded and not enter the market"),
            '1': 'open', // NEW_(1,"new order，untraded and enter the market "),
            '2': 'closed', // FILLED(2,"complete deal"),
            '3': 'open', // PART_FILLED(3,"partial deal"),
            '4': 'canceled', // CANCELED(4,"already withdrawn"),
            '5': 'canceled', // PENDING_CANCEL(5,"pending withdrawak"),
            '6': 'canceled', // EXPIRED(6,"abnormal orders");
        };
        if (status in statuses) {
            return statuses[status];
        }
        return status;
    }

    parseOrder (order, market = undefined) {
        //
        // createOrder
        //
        //     {"order_id":34343}
        //
        let side = this.safeString (order, 'OrderType');
        if (typeof side === 'undefined')
            side = this.safeString (order, 'Type');
        let isBuyOrder = (side === 'LIMIT_BUY') || (side === 'BUY');
        let isSellOrder = (side === 'LIMIT_SELL') || (side === 'SELL');
        if (isBuyOrder) {
            side = 'buy';
        }
        if (isSellOrder) {
            side = 'sell';
        }
        // We parse different fields in a very specific order.
        // Order might well be closed and then canceled.
        let status = this.parseOrderStatus (this.safeString (order, 'status'));
        let symbol = undefined;
        if (typeof market !== 'undefined') {
            symbol = market['symbol'];
        }
        let timestamp = undefined;
        if ('Opened' in order)
            timestamp = this.parse8601 (order['Opened'] + '+00:00');
        if ('Created' in order)
            timestamp = this.parse8601 (order['Created'] + '+00:00');
        let lastTradeTimestamp = undefined;
        if (('TimeStamp' in order) && (typeof order['TimeStamp'] !== 'undefined'))
            lastTradeTimestamp = this.parse8601 (order['TimeStamp'] + '+00:00');
        if (('Closed' in order) && (typeof order['Closed'] !== 'undefined'))
            lastTradeTimestamp = this.parse8601 (order['Closed'] + '+00:00');
        if (typeof timestamp === 'undefined')
            timestamp = lastTradeTimestamp;
        let iso8601 = (typeof timestamp !== 'undefined') ? this.iso8601 (timestamp) : undefined;
        let fee = undefined;
        let price = this.safeFloat (order, 'Limit');
        let cost = this.safeFloat (order, 'Price');
        let amount = this.safeFloat (order, 'Quantity');
        let remaining = this.safeFloat (order, 'QuantityRemaining');
        let filled = undefined;
        let average = this.safeFloat (order, 'PricePerUnit');
        let id = this.safeString2 (order, 'id', 'order_id');
        let result = {
            'info': order,
            'id': id,
            'timestamp': timestamp,
            'datetime': iso8601,
            'lastTradeTimestamp': lastTradeTimestamp,
            'symbol': symbol,
            'type': 'limit',
            'side': side,
            'price': price,
            'cost': cost,
            'average': average,
            'amount': amount,
            'filled': filled,
            'remaining': remaining,
            'status': status,
            'fee': fee,
        };
        return result;
    }

    async fetchOrder (id, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        let response = undefined;
        try {
            let orderIdField = this.getOrderIdField ();
            let request = {};
            request[orderIdField] = id;
            response = await this.accountGetOrder (this.extend (request, params));
        } catch (e) {
            if (this.last_json_response) {
                let message = this.safeString (this.last_json_response, 'message');
                if (message === 'UUID_INVALID')
                    throw new OrderNotFound (this.id + ' fetchOrder() error: ' + this.last_http_response);
            }
            throw e;
        }
        if (!response['result']) {
            throw new OrderNotFound (this.id + ' order ' + id + ' not found');
        }
        return this.parseOrder (response['result']);
    }

    async fetchClosedOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let request = {};
        let market = undefined;
        if (typeof symbol !== 'undefined') {
            market = this.market (symbol);
            request['market'] = market['id'];
        }
        let response = await this.accountGetOrderhistory (this.extend (request, params));
        let orders = this.parseOrders (response['result'], market, since, limit);
        if (typeof symbol !== 'undefined')
            return this.filterBySymbol (orders, symbol);
        return orders;
    }

    async fetchDepositAddress (code, params = {}) {
        await this.loadMarkets ();
        let currency = this.currency (code);
        let response = await this.accountGetDepositaddress (this.extend ({
            'currency': currency['id'],
        }, params));
        let address = this.safeString (response['result'], 'Address');
        let message = this.safeString (response, 'message');
        if (!address || message === 'ADDRESS_GENERATING')
            throw new AddressPending (this.id + ' the address for ' + code + ' is being generated (pending, not ready yet, retry again later)');
        let tag = undefined;
        if ((code === 'XRP') || (code === 'XLM')) {
            tag = address;
            address = currency['address'];
        }
        this.checkAddress (address);
        return {
            'currency': code,
            'address': address,
            'tag': tag,
            'info': response,
        };
    }

    async withdraw (code, amount, address, tag = undefined, params = {}) {
        this.checkAddress (address);
        await this.loadMarkets ();
        let currency = this.currency (code);
        let request = {
            'currency': currency['id'],
            'quantity': amount,
            'address': address,
        };
        if (tag)
            request['paymentid'] = tag;
        let response = await this.accountGetWithdraw (this.extend (request, params));
        let id = undefined;
        if ('result' in response) {
            if ('uuid' in response['result'])
                id = response['result']['uuid'];
        }
        return {
            'info': response,
            'id': id,
        };
    }

    async fetchMyTrades (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        if (typeof symbol === 'undefined') {
            throw new ExchangeError (this.id + ' fetchMyTrades requires a symbol argument');
        }
        await this.loadMarkets ();
        let market = this.market (symbol);
        let request = {
            // pageSize optional page size
            // page optional page number
            'symbol': market['id'],
        };
        if (typeof limit !== 'undefined') {
            request['pageSize'] = limit;
        }
        let response = await this.privateGetAllTrade (this.extend (request, params));
        //
        //     { code:   "0",
        //        msg:   "suc",
        //       data: {      count:    0,
        //               resultList: [ {     volume: "1.000",
        //                                     side: "BUY",
        //                                  feeCoin: "YLB",
        //                                    price: "0.10000000",
        //                                      fee: "0.16431104",
        //                                    ctime:  1510996571195,
        //                               deal_price: "0.10000000",
        //                                       id:  306,
        //                                     type: "Buy-in"        } ] } }
        //
        let trades = this.safeValue (response['data'], 'resultList', []);
        return this.parseTrades (trades, market, since, limit);
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'] + '/' + this.implodeParams (path, params);
        if (api === 'public') {
            if (Object.keys (params).length)
                url += '?' + this.urlencode (params);
        } else {
            this.checkRequiredCredentials ();
            let timestamp = this.seconds ().toString ();
            let auth = '';
            let query = this.keysort (this.extend (params, {
                'api_key': this.apiKey,
                'time': timestamp,
            }));
            let keys = Object.keys (query);
            for (let i = 0; i < keys.length; i++) {
                let key = keys[i];
                auth += key;
                auth += query[key].toString ();
            }
            let signature = this.hash (this.encode (auth + this.secret));
            if (Object.keys (query).length) {
                if (method === 'GET') {
                    url += '?' + this.urlencode (query) + '&sign=' + signature;
                } else {
                    body = this.urlencode (query) + '&sign=' + signature;
                }
            }
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
            };
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    handleErrors (httpCode, reason, url, method, headers, body) {
        if (typeof body !== 'string')
            return; // fallback to default error handler
        if (body.length < 2)
            return; // fallback to default error handler
        if ((body[0] === '{') || (body[0] === '[')) {
            let response = JSON.parse (body);
            //
            // {"code":"0","msg":"suc","data":[{"
            //
            const code = this.safeString (response, 'code');
            // const message = this.safeString (response, 'msg');
            const feedback = this.id + ' ' + this.json (response);
            const exceptions = this.exceptions;
            if (code !== '0') {
                if (code in exceptions) {
                    throw new exceptions[code] (feedback);
                } else {
                    throw new ExchangeError (feedback);
                }
            }
        }
    }
};
