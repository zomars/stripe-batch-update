import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import Stripe from "stripe";

config();

const prisma = new PrismaClient();

// Set the STRIPE_KEY in .env file in the same directory as this file
const stripe = new Stripe(process.env.STRIPE_KEY, {
  apiVersion: "2020-08-27",
});

const maxPages = 999999999; //The maximum number of pages of records to update
const pageSize = 100;
const timeout = 10000;
let pages = 0;
let numOfRecords = 0;
let delay = 0; //Used to stagger requests

const recordToList = stripe.subscriptions; // Change to stripe.SOMETHING you want to list
type Record = Stripe.Subscription; // Change to match your record to update

async function updateAll(previousId?: string) {
  const result = await updatePage(previousId);
  if (result === undefined || pages > maxPages) {
    setTimeout(
      () => console.log(`Updated ${numOfRecords} records`),
      delay++ * 500
    );
    return undefined;
  } else {
    updateAll(result);
  }
}

const PRO_PLAN_PRICE_PRODUCTION = "price_1Isw0bH8UDiwIftkETa8lRcj";

async function updatePage(previousId?: string) {
  pages++;
  console.log(`Fetching page ${pages}`);

  const response = await recordToList.list(
    {
      limit: pageSize,
      starting_after: previousId || undefined,
      price: PRO_PLAN_PRICE_PRODUCTION,
      status: "active",
      expand: ["data.customer"],
    },
    { timeout }
  );
  response.data
    // Add extra filters here
    // .filter((c) => !!c.schedule)
    .forEach((r) => setTimeout(() => updateRecord(r), delay++ * 500));
  if (response.has_more === true) {
    const lastId = response.data[response.data.length - 1].id;
    console.log(`Fetching next page starting after id ${lastId}`);
    return lastId;
  } else {
    return undefined;
  }
}

async function updateRecord(record: Record) {
  const recordId = record.id;
  const customer = record.customer as Stripe.Customer;

  numOfRecords++;
  console.log(`Updating customer ${customer.email}`);
  try {
    const updatedRecord = await prisma.user.update({
      data: {
        metadata: {
          stripeCustomerId: customer.id,
        },
      },    
      where: {
        email: customer.email!,
      },
    });
    console.log(`Successfully updated ${updatedRecord.id}`);
  } catch (error) {
    console.error(`Failed to update ${recordId}`);
    if (error instanceof Error) console.error(error.message);
  }
}

updateAll()
  .then(() => {
    console.log("Added customer IDs to user metadata");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
