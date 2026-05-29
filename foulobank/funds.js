const fs = require("fs");
const redis = require("redis");

module.exports = async (ctx) => {
		const path = "/secrets/fission-dev/foulobank-redis/uri";
		const files = fs.readdirSync('/secrets/fission-dev/foulobank-redis');
		const uri = fs.readFileSync(path, { encoding: 'utf8', flag: 'r' });
		const client = await redis.createClient({
				url: uri
		}).on("error", (err) => console.log("Redis Client Error", err))
		  .connect();
		
		await client.set("key", "value");
		const value = await client.get("key");
		client.destroy();
		return {
				status: 200,
				body: {
						files: JSON.stringify(files),
						data: data
				}
		}

}
