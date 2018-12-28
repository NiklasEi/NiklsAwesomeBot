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
const queries = {};
bot.onText( /\/play (.+)/, function( msg, match ) {
    let fromId = msg.from.id;
    let lowerCaseMatch = match[1].toLowerCase();
    if (knownGames.hasOwnProperty(lowerCaseMatch)) {
        bot.sendGame(
            fromId,
            match[1].toLowerCase(),
            {
                reply_markup: JSON.stringify({
                    inline_keyboard: [
                        [ { text: "Play 🎮", callback_game: JSON.stringify( { game_short_name: lowerCaseMatch } ) } ],
                        [ { text: "Share 🗣", url: "https://telegram.me/" + botName + "?game=" + lowerCaseMatch } ]
                    ]
                })
            }
        ).then();
    } else {
        bot.sendMessage( fromId, "Sorry " + msg.from.first_name + ", but this game doesn't exist (yet)...\nRun /games to see all games" ).then();
    }
});


bot.onText( /\/start/, function( msg ) {
    let fromId = msg.from.id;
    let user = msg.from.first_name;
    let response = "Hi there " + user + ",\n";
    response += "Run /games to see all available games";
    bot.sendMessage( fromId, response ).then();
});

bot.onText( /🎮 (.+)/, function( msg, match ) {
    if(!game_names_to_id.hasOwnProperty(match[1])) return;
    let game_short_name = game_names_to_id[match[1]];
    bot.sendGame(
        msg.from.id,
        game_short_name,
        {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    [ { text: "Play 🎮", callback_game: JSON.stringify( { game_short_name: game_short_name } ) } ],
                    [ { text: "Share 🗣", url: "https://telegram.me/" + botName + "?game=" + game_short_name } ]
                ]
            })
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

bot.on( "callback_query", function( cq ) {
    if ( cq.game_short_name ) {
        if (knownGames.hasOwnProperty(cq.game_short_name.toLowerCase())) {
            let idHash = getHash(cq.from.id);
            let gameURL = knownGames[cq.game_short_name.toLowerCase()].url;
            gameURL += "/?player=" + idHash;
            if (cq.game_short_name.toLowerCase() === "chess") {
                gameURL += "&game=" + cq.chat_instance;
            }
            bot.answerCallbackQuery( cq.id, { url: gameURL }).then();
            queries[idHash] = cq;
        } else {
            bot.answerCallbackQuery( cq.id, "Sorry, '" + cq.game_short_name + "' is not available at the moment.", true ).then();
        }
    }
});

bot.on( "inline_query", function(iq) {
    let results = [];
    for (let key in knownGames) {
        if (!knownGames.hasOwnProperty(key)) continue;
        let reply_markup = {
            inline_keyboard: [
                [ { text: "Play 🎮", callback_game: JSON.stringify( { game_short_name: key } ) } ],
                [ { text: "Share 🗣", url: "https://telegram.me/" + botName + "?game=" + key } ]
            ]
        };
        results.push({type: "game", id: key, game_short_name: key, reply_markup: reply_markup});
    }
    let promise = bot.answerInlineQuery(iq.id, results, {switch_pm_text: "Take me to the awesome bot", switch_pm_parameter: "test", cache_time: "0"});
    promise.then(function(result) {
        console.log(result);
    }, function(err) {
        console.log(err);
    });
});

// game constructor
function Game(game_short_name, name) {
    this.game_short_name = game_short_name;
    this.name = name;
    this.url = "https://" + gamesBaseUrl + "/" + game_short_name;
    this.changeURL = function (newURL) {
        this.url = newURL;
    }
}

function getHash(id) {
    return crypto.createHash('sha256')
        .update(id.toString())
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