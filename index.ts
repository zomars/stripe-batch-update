import { config } from "dotenv";
import Stripe from "stripe";

config();

// Set the STRIPE_KEY in .env file in the same directory as this file
const stripe = new Stripe(process.env.STRIPE_KEY, {
  apiVersion: "2020-08-27",
});

const maxPages = 999999999; //The maximum number of pages of records to update
const pageSize = 1000;
const timeout = 10000;
let pages = 0;
let numOfRecords = 0;
let delay = 0; //Used to stagger requests

async function cleanAll(previousId?: string) {
  const result = await cleanPage(previousId);
  if (result === undefined || pages > maxPages) {
    return undefined;
  } else {
    cleanAll(result);
  }
}

async function cleanPage(previousId?: string) {
  pages++;
  console.log(`Fetching page ${pages}`);
  const response = await stripe.customers.list(
    {
      limit: pageSize,
      starting_after: previousId || undefined,
    },
    { timeout }
  );
  response.data
    .filter((c) => c.description !== null && c.description !== "null")
    .forEach((r: { id: string }) =>
      setTimeout(() => cleanRecord(r.id), delay++ * 500)
    );
  if (response.has_more === true) {
    let lastId = response.data[response.data.length - 1].id;
    console.log(`Fetching next page starting after id ${lastId}`);
    return lastId;
  } else {
    console.log(`Cleaned ${numOfRecords} records`);
    return undefined;
  }
}

async function cleanRecord(recordId?: string) {
  numOfRecords++;
  console.log(`Cleaning ${recordId}`);
  try {
    const response = await stripe.customers.update(
      recordId,
      {
        description: null,
      },
      { timeout }
    );
    console.log(`Successfully cleaned ${recordId}`);
  } catch (error) {
    console.error(`Failed to clean ${recordId}`);
    console.error(error);
  }
}

cleanAll();
