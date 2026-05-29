const fs = require("fs");
const Redis = require("ioredis");



module.exports = async (context) => {
		const params = context.request.body;
		const source = params.source;
		if (!source) {
				return {
						status: 400,
						body: "Missing 'source' parameter to define the source bank account id"
				}
		}

		const destination = params.destination;
		if (!destination) {
				return {
						status: 400,
						body: "Missing 'destination' parameter to define the destination bank account id"
				}
		}

		const ammount = parseInt(params.ammount);
		if (!ammount) {
				return {
						status: 400,
						body: "Missing 'ammount' parameter to define the ammount of money to move"
				}
		}

		const path = "/secrets/fission-dev/foulobank-redis/uri";
		const uri = fs.readFileSync(path, { encoding: 'utf8', flag: 'r' });
		const client = new Redis(uri);
		const sold_source = await client.get(source);
		const sold_destination = await client.get(destination);

		if(!sold_source) {
				return {
						status: 404,
						body: "Source account doesn't exist"
				}
		}

		if(!sold_destination) {
				return {
						status: 404,
						body: "Destination account doesn't exist"
				}
		}

		const new_sold_source = parseInt(sold_source) - ammount;
		const new_sold_destination = parseInt(sold_destination) + ammount;
		if (new_sold_source < 0) {
				return {
						status: 400,
						body: "The source account is broke as fuck... He doesn't have enough money for this transaction (rip bozo)"
				}
		}
		await client.set(source, new_sold_source);
		await client.set(destination, new_sold_destination);
		return {
				status: 200,
				body: {
						
						source:{
								id: source,
								funds: new_sold_source
						},
						destination: {
								id: destination,
								funds: new_sold_destination
						}
				}
		}

}

