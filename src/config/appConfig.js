const { ButtonStyle } = require('discord.js');
const env = require('./env');

module.exports = {
    brand: {
        name: 'Orbit Exchange',
        color: 0xb68ced,
        buttonStyle: ButtonStyle.Secondary
    },
    text: {
        dealCompletedTitle: 'Orbit Trade | Deal Completed',
        trustFeedFooter: 'Orbit Trust Feed',
        releaseFooter: 'Orbit Release'
    },
    links: {
        ltcExplorerBase: 'https://blockchair.com/litecoin/transaction/'
    },
    assets: {
        exchangePanelImage: 'https://media.discordapp.net/attachments/1493713574181212200/1494627217781690448/exch.png?ex=69e5ee91&is=69e49d11&hm=75c40b40c512404a604fb5b776ca84d2b4d125d1154112b55b78010b2239b7c5&=&format=webp&quality=lossless&width=1000&height=313',
        claimTicketImage: 'https://cdn.discordapp.com/attachments/1474837358619922447/1492849725307748352/cdd.png?ex=69dcd426&is=69db82a6&hm=16c7e2bf70dcc57096da9822c3f6917dd2c687b139d92495f9efbe8e225b3d3a&',
        trustFeedImage: 'https://cdn.discordapp.com/attachments/1474837358619922447/1492849813866418258/trsd.png?ex=69dcd43b&is=69db82bb&hm=71b31eed4c880bb0f9bc0cc2799db2ac57a788b4f472683c756d330dc07168df&'
    },
    roles: {
        exchanger: env.ROLE_EXCHANGER_ID,
        support: env.ROLE_SUPPORT_ID,
        completedDeal: env.ROLE_COMPLETED_DEAL_ID
    },
    channels: {
        deals: env.CHANNEL_DEALS_ID,
        support: env.CHANNEL_SUPPORT_ID,
        claim: env.CHANNEL_CLAIM_ID,
        trustFeed: env.CHANNEL_TRUST_FEED_ID,
        logs: {
            withdraw: env.CHANNEL_LOG_WITHDRAW_ID,
            deposit: env.CHANNEL_LOG_DEPOSIT_ID,
            dealsClose: env.CHANNEL_LOG_DEALS_CLOSE_ID,
            supportClose: env.CHANNEL_LOG_SUPPORT_CLOSE_ID,
            transactions: env.CHANNEL_LOG_TRANSACTIONS_ID,
            errors: env.CHANNEL_LOG_ERRORS_ID,
            paymentConfig: env.CHANNEL_LOG_PAYMENT_CONFIG_ID,
            admin: env.CHANNEL_LOG_ADMIN_ID || env.CHANNEL_LOG_ERRORS_ID
        }
    },
    limits: {
        maxOpenTicketsPerUser: env.MAX_OPEN_TICKETS_PER_USER
    }
};
