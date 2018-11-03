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


bot.onText( /\/start/, function( msg ) {
    let fromId = msg.from.id;
    let user = msg.from.first_name;
    let response = "Hi there " + user + ",\n";
    response += "Run /games for a list of available games.";
    bot.sendMessage( fromId, response );
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

bot.on( "inline_query", function(iq) {
    console.log("Query ID: " + iq.id);
    let reply_markup = {
        inline_keyboard: [
            [ { text: "Play", callback_game: JSON.stringify( { game_short_name: knownGames.minesweeper.game_short_name } ) } ]
        ]
    };
    let results = [{type: "game", id: "0", game_short_name: knownGames.minesweeper.game_short_name/*, reply_markup: reply_markup}, {type: "game", id: "1", game_short_name: "minesweeper", reply_markup: reply_markup*/}];
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
    this.url = "https://" + game_short_name + "." + gamesBaseUrl;
    this.changeUrl = function (newUrl) {
        this.url = newUrl;
    }
}