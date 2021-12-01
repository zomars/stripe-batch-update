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

async function updateAll(previousId?: string) {
  const result = await updatePage(previousId);
  if (result === undefined || pages > maxPages) {
    return undefined;
  } else {
    updateAll(result);
  }
}

async function updatePage(previousId?: string) {
  pages++;
  console.log(`Fetching page ${pages}`);
  // Change to stripe.SOMETHING you want to update
  const response = await stripe.invoices.list(
    {
      limit: pageSize,
      starting_after: previousId || undefined,
      expand: ["data.subscription"],
    },
    { timeout }
  );
  response.data
    // Filter out records here
    .filter((c) => c.description !== null)
    .forEach((r: { id: string }) =>
      setTimeout(() => updateRecord(r), delay++ * 500)
    );
  if (response.has_more === true) {
    let lastId = response.data[response.data.length - 1].id;
    console.log(`Fetching next page starting after id ${lastId}`);
    return lastId;
  } else {
    console.log(`Updated ${numOfRecords} records`);
    return undefined;
  }
}

async function updateRecord(record: { id: any }) {
  const recordId = record.id;
  numOfRecords++;
  console.log(`Updating ${recordId}`);
  try {
    // Change to stripe.SOMETHING you want to update
    const response = await stripe.customers.update(
      recordId,
      {
        description: null,
      },
      { timeout }
    );
    console.log(`Successfully updated ${recordId}`);
  } catch (error) {
    console.error(`Failed to update ${recordId}`);
    console.error(error.message);
  }
}

updateAll();
