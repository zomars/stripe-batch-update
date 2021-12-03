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

const recordToList = stripe.subscriptions; // Change to stripe.SOMETHING you want to list
const recordToUpdate = recordToList; // Change to stripe.SOMETHING you want to update
type Record = Stripe.Subscription; // Change to match your record to update

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

  const response = await recordToList.list(
    {
      limit: pageSize,
      starting_after: previousId || undefined,
      // You can add filters here
      collection_method: "send_invoice",
    },
    { timeout }
  );
  response.data
    // Add extra filters here
    // .filter((c) => c.description !== null)
    .forEach((r) => setTimeout(() => updateRecord(r), delay++ * 500));
  if (response.has_more === true) {
    let lastId = response.data[response.data.length - 1].id;
    console.log(`Fetching next page starting after id ${lastId}`);
    return lastId;
  } else {
    console.log(`Updated ${numOfRecords} records`);
    return undefined;
  }
}

async function updateRecord(record: Record) {
  const recordId = record.id;
  numOfRecords++;
  console.log(`Updating ${recordId}`);
  try {
    const updatedRecord = await recordToUpdate.update(
      recordId,
      {
        // Change to desired values
        collection_method: "charge_automatically",
      },
      { timeout }
    );
    console.log(`Successfully updated ${updatedRecord.id}`);
  } catch (error) {
    console.error(`Failed to update ${recordId}`);
    console.error(error.message);
  }
}

updateAll();
