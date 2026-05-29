const fs = require("fs");
const Redis = require("ioredis");

module.exports = async (ctx) => {
		const params = ctx.request.query  || ctx.query;
		if (!params.account_id) {
				return {
						status: 400,
						body: "Missing account_id parameter in the GET request"
				}
		}
		const path = "/secrets/fission-dev/foulobank-redis/uri";
		const uri = fs.readFileSync(path, { encoding: 'utf8', flag: 'r' });
		const client = new Redis(uri);
		const keys = await client.keys(params.account_id);
		const value = await client.get(params.account_id);
		if (!value)  {
				return {
						status: 404,
						body: 'Couldn\'t find account'
				}
		}
		return {
				status: 200,
				body: {
						fund: value,
						account_id: keys
				}
		}

}
