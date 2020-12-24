# Shopping Bot with Dialogflow
An assisting bot in the form of a voice agent for a commercial website made in Dialogflow. The website can be accessed [here](https://github.com/wisc-hci-curriculum/dialogflow-beta-2020) as part of the assignment. The only changes made from this repo are the webhook, which provides the customized actions for the agent. Please check the repo for the backend endpoints.

### Features
- Sign-up & Log-in by asking the bot
- Ask the bot for a product
- Ask the bot to purchase the product
- Cart management
- Explore products by asking the bot
- Navigate to anywhere within the website
- Personalized bot
- The chat between the users and the bot is recorded

### Setup
#### Webhook
Make sure you have [npm](https://docs.npmjs.com/) installed. The first time running the program, run this command
<pre><code>npm install</code></pre>
To run the program, run this command
<pre><code>npm start</code></pre>
In order to run the webhook, open another terminal window and run this command:
<pre><code>npm run tunnel</code></pre>
You should be able to see the tunnel from ngrok to your local server running. Now, you want to copy the first https link (e.g. https://abcde12345.ngrok.io).

#### Dialogflow
Go to the [dialogflow console](https://dialogflow.cloud.google.com/) and export this [agent](WiscShopBot.zip). Then, go to `fulfillment`, and enable `webhook`. Then, fill out the URL field with the https link you retrieved from the previous step. Save it, and the bot is ready to go. To view output of the tunnel, open another terminal window and run <pre><code>npm run dev</code></pre>
This will output the logs.

#### (Optional) Local Endpoints
Since Dialogflow intent has a relatively fast timeout deadline of 5 seconds, you might want to use a local server instead. If this is the case, please follow this [setup](https://github.com/wisc-hci-curriculum/dialogflow-beta-2020).
