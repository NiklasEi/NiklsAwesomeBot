class Database {

    constructor() {
        this.inputUser = 'INSERT INTO users(id) VALUES($1) RETURNING *';
        // If more is needed update on id collision
        /*inputUser = `INSERT INTO users(id, column_1, column_2)
         VALUES (1, 'A', 'X'), (2, 'B', 'Y'), (3, 'C', 'Z')
         ON CONFLICT (id) DO UPDATE
         SET column_1 = excluded.column_1,
         column_2 = excluded.column_2;
         `;*/
        this.selectUser = 'SELECT * FROM users WHERE id = $1';
        this.crypto = require('crypto');
        const { Pool } = require('pg');
        const connectionString = 'postgres://ttqcuphuwyssta:de8e22b8c14ca07b6fcba62999c5630222f48ce6eb50678a551184412e3e5b69@ec2-54-225-196-122.compute-1.amazonaws.com:5432/d615uft3jjn887'

        this.pool = new Pool();
        // create the user table
        this.pool.query("CREATE TABLE IF NOT EXISTS users(id bigint);");
        // log idle client errors to console
        this.pool.on('error', (err, client) => {
            console.error('Unexpected error on idle client', err);
        });
        this.addUser(1);
        this.getUserById(1, user => console.log("Got: ", user));
    }

    addUser(user) {
        this.pool.query(this.inputUser, [user.id], (err, res) => {
            if (err) {
                throw err
            }

            console.log('user:', res.rows[0])
        })
    }

    getUserById(id, callback) {
        this.pool.query(this.selectUser, [id], (err, res) => {
            if (err) {
                throw err;
            }

            console.log('got user(s) by id:', res.rows);
            callback(res.rows[0]);
        })
    }

    getHashForUser(id) {
        return this.crypto.createHash('sha256')
            .update(id)
            .digest('hex');
    }
}

module.exports = Database;