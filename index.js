// Enable automatic canceling of promises
// See https://github.com/yagop/node-telegram-bot-api/issues/319
const Promise = require('bluebird');
Promise.config({
    cancellation: true
});
// remove annoying deprecation message
process.env.NTBA_FIX_319 = true;

const chessServerToken = process.env.CHESS_SERVER_TOKEN;
let TelegramBot = require( "node-telegram-bot-api" );
const debug = require('debug')('node-telegram-bot-api');
const https = require('https');
const http = require('http');
const fs = require('fs');
const bl = require('bl');
const request = require('request');
// overwrite web hook to add my own api...
require("node-telegram-bot-api/src/telegramWebHook").prototype._requestListener = function(req, res) {
    debug('WebHook request URL: %s', req.url);
    debug('WebHook request headers: %j', req.headers);

    if (req.url.indexOf(this.bot.token) !== -1) {
        if (req.method !== 'POST') {
            debug('WebHook request isn\'t a POST');
            res.statusCode = 418; // I'm a teabot!
            res.end();
        } else {
            req
                .pipe(bl(this._parseBody))
                .on('finish', () => res.end('OK'));
        }
    } else if (req.url.indexOf(chessServerToken) !== -1) {
        if (req.method !== 'POST') {
            res.statusCode = 418; // I'm a teabot!
            res.end();
        } else {
            req
                .pipe(bl(chessPost))
                .on('finish', () => res.end('OK'));
        }
    } else if (req.url.indexOf("setgamescore") !== -1) {
        if (req.method !== 'POST') {
            res.statusCode = 418; // I'm a teabot!
            res.end();
        } else {
            req
                .pipe(bl(highScorePost))
                .on('finish', () => res.end('OK'));
        }
    } else if (this._healthRegex.test(req.url)) {
        debug('WebHook health check passed');
        res.statusCode = 200;
        res.end('OK');
    } else {
        debug('WebHook request unauthorized');
        res.statusCode = 401;
        res.end();
    }
};

let token = process.env.BOT_TOKEN;
let nowUrl = process.env.NOW_URL;
let gamesBaseUrl = process.env.BASE_URL;
let botName = "NiklsAwesomeBot";
const crypto = require("crypto");

const bot_options = {
    webHook: {
        autoOpen: true,
        port: 443
    }
};

const bot = new TelegramBot( token, bot_options );
bot.setWebHook(`${nowUrl}/bot${token}`).then(function(result) {
    console.log("Web hook result: " + result);
}, function(err) {
    console.log("Web hook error: " + err);
});

// all served games are defined here
const knownGames = {
    "minesweeper": new Game("minesweeper", "Minesweeper"),
    "sudoku": new Game("sudoku", "Sudoku"),
    "chess": new Game("chess", "Chess")
};

// chess is a special case for the moment
knownGames.chess.changeURL("https://chess.nikl.me");

// define internal bot constants:
const games_inline_keyboard_name_prefix = "🎮";
const games_inline_keyboard = {
    keyboard: [],
    one_time_keyboard: true
};
const game_names_to_id = {};

// loop through all games and prepare game specific objects
let even = true;
for(const gameID in knownGames) {
    if (!knownGames.hasOwnProperty(gameID)) continue;
    even = !even;
    let game = knownGames[gameID];

    // fill inline keyboard for games
    if (!even) {
        games_inline_keyboard.keyboard.push([{ text: games_inline_keyboard_name_prefix + " " + game.name }]);
    } else {
        games_inline_keyboard.keyboard[games_inline_keyboard.keyboard.length - 1]
            .push({ text: games_inline_keyboard_name_prefix + " " + game.name });
    }
    // prepare mapping from game names to IDs
    //   with this not only the IDs have to be unique, but also the names. ToDo: so why use IDs?
    game_names_to_id[game.name] = game.game_short_name;
}

/*
    bot internals
 */

const inlineQueryResults = {};
fillInlineQueryResults();
const queries = {};
bot.onText( /\/play (.+)/, function( msg, match ) {
    let fromId = msg.from.id;
    let lowerCaseMatch = match[1].toLowerCase();
    if (knownGames.hasOwnProperty(lowerCaseMatch)) {
        bot.sendGame(
            fromId,
            match[1].toLowerCase(),
            {
                reply_markup: JSON.stringify(createGameReplyMarkup(lowerCaseMatch))
            }
        ).then();
    } else {
        bot.sendMessage( fromId, "Sorry " + msg.from.first_name + ", but this game doesn't exist (yet)...\nRun /games to see all games" ).then();
    }
});

bot.onText( /\/start (.+)/, function( msg, match ) {
    let fromId = msg.from.id;
    let user = msg.from.first_name;
    let response = "Hi there " + user + ",\n";
    response += "Run /games to see all available games";
    if(match[1]) response += "\nGot param: " + match[1];
    bot.sendMessage( fromId, response ).then();
});

bot.onText( /🎮 (.+)/, function( msg, match ) {
    if(!game_names_to_id.hasOwnProperty(match[1])) return;
    let game_short_name = game_names_to_id[match[1]];
    bot.sendGame(
        msg.from.id,
        game_short_name,
        {
            reply_markup: JSON.stringify(createGameReplyMarkup(game_short_name))
        }
    ).then();
});

bot.onText( /\/games/, function( msg ) {
    let fromId = msg.from.id;
    bot.sendMessage( fromId, "Which game would you like to play?",
        {
            reply_markup: JSON.stringify(games_inline_keyboard)
        }
    ).then();
});

joinChessMatchButtons = {};
bot.on( "callback_query", function( cq ) {
    console.log(cq);
    if ( cq.game_short_name ) {
        if (knownGames.hasOwnProperty(cq.game_short_name.toLowerCase())) {
            let idHash = getHash(cq.from.id);
            let gameURL = knownGames[cq.game_short_name.toLowerCase()].url;
            gameURL += "/?player=" + idHash;
            if (cq.game_short_name.toLowerCase() === "chess" && cq.message.reply_to_message && joinChessMatchButtons[cq.message.reply_to_message.message_id]) {
                gameURL += "&game=" + joinChessMatchButtons[cq.message.reply_to_message.message_id].id;
            }
            bot.answerCallbackQuery( cq.id, { url: gameURL }).then();
            queries[idHash] = cq;
        } else {
            bot.answerCallbackQuery( cq.id, "Sorry, '" + cq.game_short_name + "' is not available at the moment.", true ).then();
        }
    } else if(cq.data.indexOf("chess:") !== -1) {
        let data = cq.data.split(":");
        if (data.length !== 3) {
            console.log("invalid callback query: ", cq);
            bot.answerCallbackQuery( cq.id, "Invalid", true ).then();
            return;
        }
        if (data[1] === "accept") {
            bot.answerCallbackQuery( cq.id, {}).then();
            let messageContext = {
                parse_mode: "Markdown"
            };
            if (cq.inline_message_id) {
                messageContext.inline_message_id = cq.inline_message_id;
            } else {
                messageContext.chat_id = cq.message.chat.id;
                messageContext.message_id = cq.message.message_id;
            }
            if (cq.chat_instance) {
                messageContext.chat_instance = cq.chat_instance;
            }
            let gameData = {
                first_player: data[2],
                second_player: cq.from.id
            };
            request.post(
                {url:'https://chess.nikl.me/' + chessServerToken + '/newMatch', json: gameData},
                function callback(err, httpResponse, body) {
                    if (err) {
                        return console.error('Post failed:', err);
                    }
                    console.log('Post successful!  Server responded with:', body);
                    // replace inline button
                    let reply_markup = JSON.stringify({
                        inline_keyboard: [[{ text: "Share chess match", callback_data: "chess:game:" + body.id}]]
                    });
                    bot.sendMessage(messageContext.chat_instance, "**" + cq.from.first_name + `** accepted the challenge. May the force be with you!
                    
Share the match below ⬇ to get a "Play" button that takes you directly to it️. Good luck!
                    `, {parse_mode: "Markdown", reply_markup: reply_markup}).then( (result) => {}, (err) => {console.log(err);});
                }
            );
        } else if (data[1] === "game") {
            bot.answerCallbackQuery( cq.id, {}).then();
            joinChessMatchButtons[cq.message.message_id] = data[2];
            bot.sendGame(
                cq.message.chat.id,
                data[0],
                {
                    reply_to_message_id: cq.message.message_id,
                    reply_markup: JSON.stringify(createGameReplyMarkup(data[0]))
                }
            ).then(function(result) {
                // fine
            }, function(err) {
                console.log(err);
            });
        }
    }
});

function sendChessMatch(result) {
    console.log(result);
    console.log("this: ", this);
    joinChessMatchButtons[this.message_id] = this;
    bot.sendGame(
        this.chat_id,
        "chess",
        {
            reply_to_message_id: this.message_id,
            reply_markup: JSON.stringify(createGameReplyMarkup("chess"))
        }
    ).then();
}

// ToDo: a bot should answer on everything!
/*bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    console.log(msg);

    // send a message to the chat acknowledging receipt of their message
    bot.sendMessage(chatId, 'Received your message');
});*/

bot.on( "inline_query", function(iq) {
    let results = [];
    for (let key in inlineQueryResults) {
        if (!inlineQueryResults.hasOwnProperty(key)) continue;
        results.push(inlineQueryResults[key]);
    }
    results.push(buildChessInviteIQresult(iq.from));
    let promise = bot.answerInlineQuery(iq.id, results, {switch_pm_text: "Take me to the awesome bot", switch_pm_parameter: "inline_query", cache_time: "60", is_personal: true});
    promise.then(function(result) {
        // fine
    }, function(err) {
        console.log(err);
    });
});

function fillInlineQueryResults() {
    // game results
    for (let key in knownGames) {
        if (!knownGames.hasOwnProperty(key)) continue;
        inlineQueryResults[key] = {type: "game", id: key, game_short_name: key, reply_markup: createGameReplyMarkup(key)};
    }
}

function createGameReplyMarkup(gameID) {
    let reply_markup = {
        inline_keyboard: [
            [ { text: "Play 🎮" , callback_game: JSON.stringify( { game_short_name: gameID} )} ],
            [ { text: "Share 🗣", switch_inline_query: gameID } ]
        ]
    };
    if(gameID === 'chess') {
        reply_markup.inline_keyboard[0]
            .push({ text: "New match 👥", switch_inline_query: "chess:new"});
    }
    return reply_markup;
}

function buildChessInviteIQresult(invitingPlayer) {
    let reply_markup = {
        inline_keyboard: [
            [ { text: "Accept" , callback_data: "chess:accept:" + invitingPlayer.id} ]
        ]
    };
    // chess gif file_id: CgADBAADmQADl1NdUbrv7JZGF-G0Ag
    return {type: 'article', id: 1
        , title: "Offer chess match"
        , reply_markup: reply_markup
        , thumb_url: "https://chess.nikl.me/assets/img/chesspieces/wikipedia/wK.png"
        , description: "Ask anyone in this chat to play a round of chess against you"
        , input_message_content: {message_text: "**" + invitingPlayer.first_name + "** would like to play a round of chess against you. Do you think you can win?", parse_mode: "Markdown"}
    }
}

// game constructor
function Game(game_short_name, name) {
    this.game_short_name = game_short_name;
    this.name = name;
    this.url = gamesBaseUrl + "/" + game_short_name;
    this.changeURL = function (newURL) {
        this.url = newURL;
    }
}

function getHash(id) {
    return crypto.createHash('sha256')
        .update(id.toString())
        .digest('hex');
}

// for message verification between bot and chess server
// ToDo: not needed due to API path with token?
function createChessHmac(message) {
    return crypto.createHmac('sha256', chessServerToken)
        .update(message.toString())
        .digest('hex');
}

// ToDo: instead of sending scores, post a bot message in the chat announcing the victory / draw
function chessPost(error, body) {
    if (error) {
        console.error(error);
        return;
    }
    let data;
    try {
        data = JSON.parse(body.toString());
    } catch (parseError) {
        console.error(parseError);
        return;
    }
    if (!data) return;
    const highScore = data.high_score;
    const idHash = data.id_hash;

    let query = queries[idHash];
    let options;
    if (query.message) {
        options = {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id
        };
    } else {
        options = {
            inline_message_id: query.inline_message_id
        };
    }
    bot.setGameScore(query.from.id, parseInt(highScore),  options).then( value => {
        // everything fine
    }, reason => {
        if(reason.Error && reason.Error.indexOf("BOT_SCORE_NOT_MODIFIED") !== -1) {
            // ignore: the new score is simply lower then the old one
            return;
        }
        console.log("Error while updating high score:");
        console.error(reason);
    });
}

function highScorePost(error, body) {
    if (error) {
        console.error(error);
        return;
    }
    if(!body) return;
    let data;
    try {
        data = JSON.parse(body.toString());
    } catch (parseError) {
        console.error(parseError);
        return;
    }
    const highScore = data.high_score;
    const idHash = data.id_hash;

    let query = queries[idHash];
    // make sure no one tries to send a chess high score through this open endpoint
    if(query.game_short_name === "chess") {
        console.log("Someone tried to fake a chess score ^^ ", query);
        return;
    }
    let options;
    if (query.message) {
        options = {
            chat_id: parseInt(query.message.chat.id),
            message_id: parseInt(query.message.message_id)
        };
    } else {
        options = {
            inline_message_id: query.inline_message_id
        };
    }
    console.log("Sending high score of ", parseInt(highScore), " from ", query.from.id, " with options ", options);
    bot.setGameScore(query.from.id, parseInt(highScore),  options).then( value => {
        // everything fine
    }, reason => {
        if(reason.Error && reason.Error.indexOf("BOT_SCORE_NOT_MODIFIED") !== -1) {
            // ignore: the new score is simply lower then the old one
            return;
        }
        console.log("Error while updating high score:");
        console.error(reason);
    });
}