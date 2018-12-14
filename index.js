const Promise = require('bluebird');
Promise.config({
    cancellation: true
});
let TelegramBot = require( "node-telegram-bot-api" );
let token = process.env.BOT_TOKEN;
let nowUrl = process.env.NOW_URL;
let gamesBaseUrl = process.env.BASE_URL;
let botName = "NiklsAwesomeBot";
let port = process.env.PORT || 3000;

const options = {
    webHook: {
        autoOpen: true,
        port: port
    }
};

const bot = new TelegramBot( token, options );
bot.setWebHook(`${nowUrl}/bot${token}`).then(function(result) {
    console.log("Web hook result: " + result);
}, function(err) {
    console.log("Web hook error: " + err);
});

// games:
const knownGames = {
    "minesweeper": new Game("minesweeper", "Minesweeper"),
    "sudoku": new Game("sudoku", "Sudoku")
};

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
                        [ { text: "Play", callback_game: JSON.stringify( { game_short_name: lowerCaseMatch } ) } ],
                        [ { text: "Share", url: "https://telegram.me/" + botName + "?game=" + lowerCaseMatch } ]
                    ]
                })
            }
        );
    } else {
        bot.sendMessage( fromId, "Sorry " + msg.from.first_name + ", but this game doesn't exist (yet)...\nRun /games to see all games" );
    }
});


bot.onText( /\/start/, function( msg ) {
    let fromId = msg.from.id;
    let user = msg.from.first_name;
    let response = "Hi there " + user + ",\n";
    response += "Run /games for a list of available games.";
    bot.sendMessage( fromId, response );
});

bot.onText( /\/games/, function( msg ) {
    let fromId = msg.from.id;
    let response = "You can play:";
    for (let key in knownGames) {
        if (!knownGames.hasOwnProperty(key)) continue;
        response += "\n" + knownGames[key].name + " (/play " + key + ")";
    }
    bot.sendMessage( fromId, response );
});

bot.onText( /\/test/, function( msg ) {
    let fromId = msg.from.id;
    let response = "Test value: 1";
    bot.sendMessage( fromId, response );
});

bot.on( "callback_query", function( cq ) {
    if ( cq.game_short_name ) {
        let userID = cq.from.id;
        let messageID = cq.message.message_id;
        let chatID = cq.message.chat.id;
        let inlineMessageID = cq.inline_message_id;
        if (knownGames.hasOwnProperty(cq.game_short_name.toLowerCase())) {
            console.log("answer query with: " + knownGames[cq.game_short_name.toLowerCase()].url);
            bot.answerCallbackQuery( cq.id, { url: knownGames[cq.game_short_name.toLowerCase()].url });
        } else {
            bot.answerCallbackQuery( cq.id, "Sorry, '" + cq.game_short_name + "' is not available at the moment.", true );
        }
    }
});

bot.on( "inline_query", function(iq) {
    let results = [];
    for (let key in knownGames) {
        if (!knownGames.hasOwnProperty(key)) continue;
        let reply_markup = {
            inline_keyboard: [
                [ { text: "Play", callback_game: JSON.stringify( { game_short_name: key } ) } ],
                [ { text: "Share", url: "https://telegram.me/" + botName + "?game=" + key } ]
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

function Game(game_short_name, name) {
    this.game_short_name = game_short_name;
    this.name = name;
    this.url = "https://" + gamesBaseUrl + "/" + game_short_name;
    this.changeUrl = function (newUrl) {
        this.url = newUrl;
    }
}