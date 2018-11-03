const Promise = require('bluebird');
Promise.config({
    cancellation: true
});
let TelegramBot = require( "node-telegram-bot-api" );
let token = process.env.BOT_TOKEN;
let nowUrl = process.env.NOW_URL;
let gamesBaseUrl = process.env.GAMES_BASE_URL;

const options = {
    webHook: {
        port: 443
    }
};

const bot = new TelegramBot( token, options );
bot.setWebHook(`${nowUrl}/bot${token}`);

// games:
const knownGames = {
    "minesweeper": new Game("minesweeper", "Minesweeper")
};

bot.onText( /\/play (.+)/, function( msg, match ) {
    let fromId = msg.from.id;
    if (knownGames.hasOwnProperty(match[1].toLowerCase())) {
        bot.sendGame(
            fromId,
            match[1].toLowerCase(),
            {
                reply_markup: JSON.stringify({
                    inline_keyboard: [
                        [ { text: "Play", callback_game: JSON.stringify( { game_short_name: match[1].toLowerCase() } ) } ],
                        [ { text: "Share", url: "https://telegram.me/NiklsAwesomeBot?game=" + match[1].toLowerCase() } ]
                    ]
                })
            }
        );
    } else {
        bot.sendMessage( fromId, "Sorry " + msg.from.first_name + ", but this game doesn't exist (yet)...\nRun /games to see all games" );
    }
});

bot.onText( /\/games/, function( msg, match ) {
    let fromId = msg.from.id;
    let response = "You can play:";
    for (let key in knownGames) {
        if (!knownGames.hasOwnProperty(key)) continue;
        response += "\n" + knownGames[key].game_short_name;
    }
    bot.sendMessage( fromId, response );
});

bot.on( "callback_query", function( cq ) {
    if ( cq.game_short_name ) {
        if (knownGames.hasOwnProperty(cq.game_short_name.toLowerCase())) {
            console.log("answer query with: " + knownGames[cq.game_short_name.toLowerCase()].url);
            bot.answerCallbackQuery( cq.id, { url: knownGames[cq.game_short_name.toLowerCase()].url });
        } else {
            bot.answerCallbackQuery( cq.id, "Sorry, '" + cq.game_short_name + "' is not available at the moment.", true );
        }
    }
});

function Game(game_short_name, name) {
    this.game_short_name = game_short_name;
    this.name = name;
    this.url = "https://" + game_short_name + "." + gamesBaseUrl;
    this.changeUrl = function (newUrl) {
        this.url = newUrl;
    }
}