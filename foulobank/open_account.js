const fs = require("fs");
const Redis = require("ioredis");

function genId(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let output = "";
  for(let i = 0; i < length; i++){
		let rand = Math.floor(Math.random() * chars.length);
		output += chars[rand];
  }
		return output;
}


module.exports = async (ctx) => {
		const BASE_FUND = 200;
		const id = genId(10);
		const account_id = `FOULO-${id}`;
		const path = "/secrets/fission-dev/foulobank-redis/uri";
		const uri = fs.readFileSync(path, { encoding: 'utf8', flag: 'r' });
		const client = new Redis(uri);
		const keys = await client.set(account_id, BASE_FUND);
		return {
				status: 200,
				body: {
						account_id: account_id,
						funds: BASE_FUND
				}
		}

}

