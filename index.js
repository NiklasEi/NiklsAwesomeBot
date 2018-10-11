const Promise = require('bluebird');
Promise.config({
    cancellation: true
});
var TelegramBot = require( "node-telegram-bot-api" );
var token = process.env.BOT_TOKEN;
var nowUrl = process.env.NOW_URL;

const options = {
    webHook: {
        port: 443
    }
};

var bot = new TelegramBot( token, options );
bot.setWebHook(`${nowUrl}/bot${token}`);

// Matches "/echo [whatever]"
bot.onText(/\/echo (.+)/, (msg, match) => {
    // 'msg' is the received Message from Telegram
    // 'match' is the result of executing the regexp above on the text content
    // of the message

    const chatId = msg.chat.id;
    const resp = match[1]; // the captured "whatever"

    // send back the matched "whatever" to the chat
    bot.sendMessage(chatId, resp);
});

bot.onText( /\/play (.+)/, function( msg, match ) {
    var fromId = msg.from.id;
    switch( match[1].toLowerCase() ) {
        case "minesweeper":
            bot.sendGame(
                fromId,
                "minesweeper",
                {
                    reply_markup: JSON.stringify({
                        inline_keyboard: [
                            [ { text: "Play", callback_game: JSON.stringify( { game_short_name: "TestGame" } ) } ],
                            [ { text: "Share", url: "https://telegram.me/NiklsAwesomeBot?game=minesweeper" } ]
                        ]
                    })
                }
            );
            break;
        default:
            bot.sendMessage( fromId, "Sorry " + msg.from.first_name + ", but this game doesn’t exist (yet)..." );
    }
});

bot.on( "callback_query", function( cq ) {
    if ( cq.game_short_name ) {
        switch( cq.game_short_name ) {
            case "minesweeper":
                bot.answerCallbackQuery( cq.id, undefined, false, { url: "https://html5-minesweeper-gynkmlngaa.now.sh" } );
                return;
        }
        bot.answerCallbackQuery( cq.id, "Sorry, '" + cq.game_short_name + "' is not available.", true );
    }
});

// Listen for any kind of message. There are different kinds of
// messages.
bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    // send a message to the chat acknowledging receipt of their message
    bot.sendMessage(chatId, 'Received your message');
});