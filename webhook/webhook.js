const express = require('express')
const { WebhookClient } = require('dialogflow-fulfillment')
const app = express()
const fetch = require('node-fetch')
const base64 = require('base-64')
const { request } = require('http')
const { isNull } = require('util')
const { UV_FS_O_FILEMAP } = require('constants')

let username = "";
let password = "";
let token = "";

USE_LOCAL_ENDPOINT = false;
// set this flag to true if you want to use a local endpoint
// set this flag to false if you want to use the online endpoint
ENDPOINT_URL = ""
if (USE_LOCAL_ENDPOINT) {
  ENDPOINT_URL = "http://127.0.0.1:5000"
} else {
  ENDPOINT_URL = "https://mysqlcs639.cs.wisc.edu"
}



async function getToken() {
  let request = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + base64.encode(username + ':' + password)
    },
    redirect: 'follow'
  }

  const serverReturn = await fetch(ENDPOINT_URL + '/login', request)

  if (serverReturn.status != 200) {
    console.log(serverReturn.status + ": unauthorized login");
    return null;
  }


  const serverResponse = await serverReturn.json()
  token = serverResponse.token

  return token;
}

app.get('/', (req, res) => res.send('online'))
app.post('/', express.json(), (req, res) => {
  const agent = new WebhookClient({ request: req, response: res })

  async function clear_messages() {
    let request = {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token
      }
    };
    const res = await fetch(ENDPOINT_URL + "/application/messages", request);
    if (res.status != 200) {
      console.log(res.status + ": failed to clear messages")
      return false;
    } else {
      return true;
    }
  }

  async function send_message(text, isUser) {
    let request = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token
      },
      body: JSON.stringify({
        isUser: isUser,
        text: text
      })
    };
    const res = await fetch(ENDPOINT_URL + "/application/messages", request);
    if (res.status != 200) {
      console.log(res.status + ": failed to send message")
      return false;
    } else {
      return true;
    }
  }

  function welcome() {
    send_message(agent.query, true);
    let res = 'Welcome to WiscShop Badger Store! I am Buzzy, the assistant bot here. How can I help you today?';
    agent.add(res)
    console.log(ENDPOINT_URL);
    send_message(res, false);
  }

  function randomized_response(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  async function navigate_to_helper(page) {
    let request = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token
      },
      body: JSON.stringify({
        back: false,
        dialogflowUpdated: true,
        page: "/" + page
      })
    };
    const res = await fetch(ENDPOINT_URL + "/application", request);
    if (res.status != 200) {
      console.log(res.status + ": failed to navigate")
      return false;
    } else {
      return true;
    }
  }

  async function navigate_to() {
    send_message(agent.query, true);
    let page = agent.parameters.page;
    let success = false;

    let currPage = await get_current_page();
    if (!isNull(currPage)) {
      let splitted_url = currPage.split("/");
      if (splitted_url[splitted_url.length - 1] === "cart") {
        return confirm_and_purchase();
      }
    }

    if (page === "home") {
      success = await navigate_to_helper(username);
    } else if (page === "sign in") {
      success = await navigate_to_helper("");
    } else {
      success = await navigate_to_helper(username + "/" + page);
    }

    if (!success) {
      send_message("Oops! You have to login first before accessing the page!", false);
      agent.add("Oops! You have to login first before accessing the page!");
    } else {
      if (page === "home") {
        let responses_list = [
          "We’re back to the home screen.",
          "Back to the home screen.",
          "Home sweet home! Home screen it is."
        ]
        let resp = randomized_response(responses_list);
        send_message(resp, false);
        agent.add(resp);
        agent.context.set({
          'name': 'current_page',
          'lifespan': 0,
          'parameters': {
            'currPage': page
          }
        });
      } else {
        let responses_list = [
          "Understood! We have arrived at " + page,
          "Here it is, we are at the " + page + " page.",
          "Heading to " + page + " right away, and here we are!"
        ]

        if (page !== "cart" && page !== "sign in") {
          agent.context.set({
            'name': 'current_page',
            'lifespan': 5,
            'parameters': {
              'currPage': page,
            }
          });
        }
        let resp = randomized_response(responses_list);
        send_message(resp, false);
        agent.add(resp);
      }
    }
  }

  async function login() {

    // You need to set this from `username` entity that you declare in DialogFlow
    username = agent.parameters.username.replace(/\s/g, "")
    // You need to set this from password entity that you declare in DialogFlow
    password = agent.parameters.password.replace(/\s/g, "")
    let valid = await getToken()

    if (valid != null) {
      let ls_response = [
        "Yay, you’re in! I can also help you find almost everything. You name it!",
        "Login success, yaaay! I can also help you find almost everything. You name it!",
        "You're in. Welcome! Let me help you find almost everything. You name it!"
      ];
      let resp = randomized_response(ls_response);
      send_message(resp, false);
      agent.add(resp);
      navigate_to_helper(username);
      await clear_messages();
    } else {
      send_message("Oops! It looks like your username or password might be wrong.", false);
      agent.add("Oops! It looks like your username or password might be wrong.");
    }
  }

  async function get_all_tags(category) {
    let request = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };
    const res = await fetch(ENDPOINT_URL + "/categories/" + category + "/tags", request);
    if (res.status != 200) {
      console.log(res.status + ": failed to retrieve all tags")
      return null;
    } else {
      const resObj = await res.json();
      return resObj;
    }
  }

  async function show_all_tags() {
    send_message(agent.query, true);
    let page;
    if (agent.parameters.page === "") {
      let context = agent.context.get("current_page");
      if (typeof context !== 'undefined') {
        page = context.parameters.currPage;
      } else {
        send_message("Ummm... are you trying to ask for the list of tags of a category? If so, please try again with a category.", false);
        agent.add("Ummm... are you trying to ask for the list of tags of a category? If so, please try again with a category.");
        return;
      }
    } else {
      page = agent.parameters.page;
    }
    let tags = await get_all_tags(page);
    if (isNull(tags)) {
      send_message("Whoops! Unfortunately, it looks like there is no tag in this category.", false);
      agent.add("Whoops! Unfortunately, it looks like there is no tag in this category.");
      return;
    }

    let responses_list = [
      "We have a variety of " + page + " that can be categorized by tags to narrow down the search result: ",
      "Here are the list of tags that you can select to narrow down the search result " + page + ": ",
      "For " + page + ", we have a list of tags to help you find your preference more easily: "
    ]
    let resp = randomized_response(responses_list);
    if (!isNull(tags)) {
      for (let i = 0; i < tags.tags.length; i++) {
        resp += tags.tags[i];
        if (tags.tags.length > 1 && i != tags.tags.length - 1) {
          resp += ", "
        }
        if (i == tags.tags.length - 2) {
          resp += "and "
        }
      }
      resp += "."
      send_message(resp, false);
      agent.add(resp);
    } else {
      send_message("Whoops! Unfortunately, it looks like there is no tag in this category.", false);
      agent.add("Whoops! Unfortunately, it looks like there is no tag in this category.")
    }
  }

  async function set_tags(tag) {
    let request = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token
      }
    };
    const res = await fetch(ENDPOINT_URL + "/application/tags/" + tag, request);
    if (res.status != 200) {
      console.log(res.status + ": failed to add a new tag")
      return false;
    } else {
      return true;
    }
  }

  async function get_current_page() {
    let request = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token
      }
    };
    const res = await fetch(ENDPOINT_URL + "/application", request);
    if (res.status != 200) {
      console.log(res.status + ": failed to get the application state")
      return null;
    } else {
      let resJson = await res.json();
      return resJson.page;
    }
  }

  async function navigate_to_and_filter() {
    send_message(agent.query, true);
    let page;
    if (agent.parameters.page === "") {
      let context = agent.context.get("current_page");
      if (typeof context !== 'undefined') {
        page = context.parameters.currPage;
      } else {
        let resp = "Ummm... you are trying to get the " + agent.parameters.tags.join(', ') + "..., but of what category?. Please try again with a category.";
        send_message(resp, false);
        agent.add(resp);
        return;
      }
    } else {
      page = agent.parameters.page;
    }

    if (page === "sign up" || page === "home" || page === "cart") {
      send_message("Whoops! Unfortunately, it looks like there is no tag in this category.", false);
      agent.add("Whoops! Unfortunately, it looks like there is no tag in this category.");
      return;
    }
    success = await navigate_to_helper(username + "/" + page);
    if (!success) {
      send_message("Whoops! Unfortunately, it looks like there is no tag in this category.", false);
      agent.add("Whoops! Unfortunately, it looks like there is no tag in this category.");
      return;
    }

    let curr_page = get_current_page();
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000));
      if (("/" + username + "/" + page) !== curr_page) {
        break;
      }
      if (isNull(curr_page)) {
        send_message("Oops.. Something went wrong with the server. Please try again later.", false);
        agent.add("Oops.. Something went wrong with the server. Please try again later.");
        return;
      }
    }

    let resp_list = [
      "I have applied these tags under " + page + ", only for you: ",
      "Here are some " + page + " that I found under the tags you specified: ",
      "I found some " + page + " that I found under the tags you specified: "
    ]
    let resp = randomized_response(resp_list);
    let categoryTag = await get_all_tags(page);
    let count = 0;

    for (let i = 0; i < agent.parameters.tags.length; i++) {
      if (!categoryTag.tags.includes(agent.parameters.tags[i])) {
        send_message("Ummm... there is no tag " + agent.parameters.tags[i] + " under " + page + ", so I will exlude that from the result.", false);
        agent.add("Ummm... there is no tag " + agent.parameters.tags[i] + " under " + page + ", so I will exlude that from the result.")
      } else {
        let success_add_tag = await set_tags(agent.parameters.tags[i]);
        if (success_add_tag) {
          resp += agent.parameters.tags[i];
          if (agent.parameters.tags.length > 1 && i != agent.parameters.tags.length - 1) {
            resp += ", "
          }
          if (i == agent.parameters.tags.length - 2) {
            resp += "and "
          }
          count += 1;
        } else {
          send_message("Ummm... there is no tag " + agent.parameters.tags[i] + " under " + page + ", so I will exlude that from the result.", false);
          agent.add("Ummm... There is no tag " + agent.parameters.tags[i] + " under " + page + ", so I will exlude that from the result.");
        }
      }
    }

    resp += ".";
    if (count > 0) {
      send_message(resp, false);
      agent.add(resp);
    } else {
      send_message("Sorry, I could not find anything under these tags.", false);
      agent.add("Sorry, I could not find anything under these tags.");
    }
  }

  async function get_items_in_cart() {
    let request = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token
      }
    };
    const res = await fetch(ENDPOINT_URL + "/application/products", request);
    if (res.status != 200) {
      console.log(res.status + ": failed to get the application products")
      return [];
    } else {
      let resJson = await res.json();
      return resJson.products;
    }
  }

  async function cart_info() {
    send_message(agent.query, true);
    let items = await get_items_in_cart();
    let resp = "";
    let category = new Map();
    let total = 0;
    let count = 0;
    if (items.length == 0) {
      send_message("Right now, you don't have anything in your cart.", false);
      agent.add("Right now, you don't have anything in your cart.");
      return;
    }
    for (let i = 0; i < items.length; i++) {
      if (category.has(items[i].category)) {
        category.set(items[i].category, category.get(items[i].category) + items[i].count);
      } else {
        category.set(items[i].category, items[i].count);
      }
      total += items[i].price * items[i].count;
      count += items[i].count;
    }
    resp += "You have a total of " + count + " items in your cart: ";
    for (const [key, value] of category.entries()) {
      if (value > 1) {
        resp += value + "x " + key;
      } else {
        resp += value + "x " + key.substring(0, key.length - 1);
      }
      resp += ", ";
    }
    resp = resp.substring(0, resp.length - 2);
    resp += ".";
    send_message(resp, false);
    send_message("In total: $" + total, false);
    agent.add(resp);
    agent.add("In total: $" + total);
  }

  async function get_all_products() {
    let request = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    const res = await fetch(ENDPOINT_URL + "/products", request);
    if (res.status != 200) {
      console.log(res.status + ": failed to get the products")
      return [];
    } else {
      let resJson = await res.json();
      return resJson.products;
    }
  }

  async function add_product_to_server(id) {
    let request = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token
      }
    };
    const res = await fetch(ENDPOINT_URL + "/application/products/" + id, request);
    if (res.status != 200) {
      console.log(res.status + ": failed to add to cart")
      return false;
    } else {
      return true;
    }
  }

  async function remove_product_from_server(id) {
    let request = {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token
      }
    };
    const res = await fetch(ENDPOINT_URL + "/application/products/" + id, request);
    if (res.status != 200) {
      console.log(res.status + ": failed to remove from cart")
      return false;
    } else {
      return true;
    }
  }

  async function add_to_cart() {
    send_message(agent.query, true);
    let product = agent.parameters.product;
    let pid;
    if (product === "" || isNull(product)) {
      let url = await get_current_page();
      let splitted_url = url.split("/");
      pid = parseInt(splitted_url[splitted_url.length - 1]);
      if (isNaN(pid)) {
        send_message("Ummm... I don't know what to buy. Can you please try again once you found what you are looking for? You can either go to a specific product, or name the product right away.", false);
        agent.add("Ummm... I don't know what to buy. Can you please try again once you found what you are looking for? You can either go to a specific product, or name the product right away.");
        return;
      }
    } else {
      let all_products = await get_all_products();
      if (all_products.length == 0) {
        send_message("Oops! There is something wrong with our server. Please try again later, ok?", false);
        agent.add("Oops! There is something wrong with our server. Please try again later, ok?");
        return;
      }
      for (let i = 0; i < all_products.length; i++) {
        if (all_products[i].name === product) {
          pid = all_products[i].id;
          break;
        }
      }
      if (pid === undefined) {
        send_message("Oops! It seems that we don't have that product.", false);
        agent.add("Oops! It seems that we don't have that product.");
        return;
      }
    }

    let n = parseInt(agent.parameters.number);
    for (let i = 0; i < n; i++) {
      let success = await add_product_to_server(pid);
      if (!success) {
        send_message("Uh, oh! There is something wrong with our server. Please try again later, ok?", false);
        agent.add("Uh, oh! There is something wrong with our server. Please try again later, ok?");
        return;
      }
    }

    let item = n > 1 ? "items" : "item";
    let responses_list = [
      "Got it! Just added " + n + " of this item to your cart.",
      "I have added " + n + " of this item to the cart. Cheers!",
      "Order up! " + n + " " + item + " have been added to your cart."
    ]
    let resp = randomized_response(responses_list)
    send_message(resp, false);
    agent.add(resp);
  }

  async function remove_from_cart() {
    send_message(agent.query, true);
    let product = agent.parameters.product;
    let pid;
    if (product === "" || isNull(product)) {
      let url = await get_current_page();
      let splitted_url = url.split("/");
      pid = parseInt(splitted_url[splitted_url.length - 1]);
      if (isNaN(pid)) {
        send_message("Ummm... I don't know what to remove. Can you please try again once you found what you are looking for? You can either go to a specific product, or name the product right away.", false);
        agent.add("Ummm... I don't know what to remove. Can you please try again once you found what you are looking for? You can either go to a specific product, or name the product right away.");
        return;
      }
    } else {
      let all_products = await get_all_products();
      if (all_products.length == 0) {
        send_message("Oops! There is something wrong with our server. Please try again later, ok?", false);
        agent.add("Oops! There is something wrong with our server. Please try again later, ok?");
        return;
      }
      for (let i = 0; i < all_products.length; i++) {
        if (all_products[i].name === product) {
          pid = all_products[i].id;
          break;
        }
      }
      if (pid === undefined) {
        send_message("Oops! It seems that you don't have that in your cart.", false);
        agent.add("Oops! It seems that you don't have that in your cart.");
        return;
      }
    }

    let n = parseInt(agent.parameters.num);

    if (agent.parameters.num === "") {
      n = 1;
    }

    let i = 0;
    while (true) {
      if (agent.parameters.num !== "all" && i === n) {
        break;
      }

      let success = await remove_product_from_server(pid);

      if (!success) {
        break;
      }

      i += 1;
    }

    if (i == 0) {
      send_message("Oops! It seems that you don't have that in your cart.", false);
      agent.add("Oops! It seems that you don't have that in your cart.");
      return;
    }

    let item = i > 1 ? "items" : "item";
    let responses_list = [
      "Got it! Just removed " + i + " of this item from your cart.",
      "I have removed " + i + " of this item from the cart. Cheers!",
      "Understood! " + i + " " + item + " have been removed from your cart."
    ]
    let resp = randomized_response(responses_list)
    send_message(resp, false);
    agent.add(resp);
  }

  async function go_back() {
    send_message(agent.query, true);
    let request = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token
      },
      body: JSON.stringify({
        back: true
      })
    };
    const res = await fetch(ENDPOINT_URL + "/application", request);
    if (res.status != 200) {
      console.log(res.status + ": failed to go back")
      send_message("Oops! You can't go back anymore.", false);
      agent.add("Oops! You can't go back anymore.")
    } else {
      let responses_list = ["Heading back!", "Going to the previous page.", "Teleport backward!"];
      let resp = randomized_response(responses_list);
      send_message(resp, false);
      agent.add(resp);
    }
  }

  async function get_product(id) {
    let request = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    const res = await fetch(ENDPOINT_URL + "/products/" + id, request);
    if (res.status != 200) {
      console.log(res.status + ": failed to get product details")
      return undefined;
    } else {
      let obj = await res.json();
      return obj;
    }
  }

  async function get_reviews(id) {
    let request = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    const res = await fetch(ENDPOINT_URL + "/products/" + id + "/reviews", request);
    if (res.status != 200) {
      console.log(res.status + ": failed to get product reviews")
      return [];
    } else {
      let obj = await res.json();
      return obj.reviews;
    }
  }

  async function product_info() {
    send_message(agent.query, true);
    let product = agent.parameters.product;
    let pid;
    if (product === "" || isNull(product)) {
      let url = await get_current_page();
      let splitted_url = url.split("/");
      pid = parseInt(splitted_url[splitted_url.length - 1]);
      if (isNaN(pid)) {
        send_message("Ummm... I don't understand your request. Can you please try again once you found what you are looking for? You can either go to a specific product, or name the product right away.", false);
        agent.add("Ummm... I don't understand your request. Can you please try again once you found what you are looking for? You can either go to a specific product, or name the product right away.");
        return;
      }
    } else {
      let all_products = await get_all_products();
      if (all_products.length == 0) {
        send_message("Oops! There is something wrong with our server. Please try again later, ok?", false);
        agent.add("Oops! There is something wrong with our server. Please try again later, ok?");
        return;
      }
      for (let i = 0; i < all_products.length; i++) {
        if (all_products[i].name === product) {
          pid = all_products[i].id;
          break;
        }
      }
      if (pid === undefined) {
        send_message("Oops! It seems that we don't have that product.", false);
        agent.add("Oops! It seems that we don't have that product.");
        return;
      }
    }

    let new_product = await get_product(pid);
    if (new_product === undefined) {
      send_message("Oops! It seems that we don't have that product.", false);
      agent.add("Oops! It seems that we don't have that product.")
    }

    let reviews = await get_reviews(pid);
    let max = 0;
    let min = 6;
    let top_review;
    let worst_review;
    let total = 0;
    for (let i = 0; i < reviews.length; i++) {
      total += reviews[i].stars;
      if (reviews[i].stars > max) {
        top_review = reviews[i];
        max = reviews[i].stars;
      }
      if (reviews[i].stars < min) {
        worst_review = reviews[i];
        min = reviews[i].stars;
      }
    }
    let avg = 0;
    let resp2 = "";
    let text_reviews = reviews.length > 1 ? "reviews" : "review";
    if (reviews.length > 0) {
      avg = total / reviews.length;
      resp2 = "This item has " + reviews.length + " " + text_reviews + " with an average rating of " + avg + " stars.";
      resp2 += "This is the review from our customer who rated this as high as " + top_review.stars + " stars: " + '"' + top_review.title + ". " + top_review.text + '"' + "."
      if (top_review.id != worst_review.id) {
        //resp2 += "This is the review from our customer who rated this as low as " + worst_review.stars + " stars: " + worst_review.title + ". " + worst_review.text + "."
      }
    }

    let category = new_product.category.substring(0, new_product.category.length - 1);
    let description = new_product.description;
    let price = new_product.price;
    let name = new_product.name;
    let nice_text = avg > 3 ? "That's a nice one! " : "";
    let context_description = name !== description ? ' This is the description: "' + description + '"' : '';
    let responses_list = [
      "This is " + name + ". This " + category + " is $" + price + " each." + context_description,
      "This is " + name + ". " + nice_text + "This is a " + category + " that cost $" + price + "." + context_description,
      "This is " + name + ". " + nice_text + "This is a $" + price + " " + category + "." + context_description
    ]
    agent.add(randomized_response(responses_list));
    if (resp2 !== "") {
      send_message(resp2, false);
      agent.add(resp2);
    }
  }

  async function product_rating() {
    send_message(agent.query, true);
    let product = agent.parameters.product;
    let pid;
    if (product === "" || isNull(product)) {
      let url = await get_current_page();
      let splitted_url = url.split("/");
      pid = parseInt(splitted_url[splitted_url.length - 1]);
      if (isNaN(pid)) {
        send_message("Ummm... I don't understand your request. Can you please try again once you found what you are looking for? You can either go to a specific product, or name the product right away.", false);
        agent.add("Ummm... I don't understand your request. Can you please try again once you found what you are looking for? You can either go to a specific product, or name the product right away.");
        return;
      }
    } else {
      let all_products = await get_all_products();
      if (all_products.length == 0) {
        send_message("Oops! There is something wrong with our server. Please try again later, ok?", false);
        agent.add("Oops! There is something wrong with our server. Please try again later, ok?");
        return;
      }
      for (let i = 0; i < all_products.length; i++) {
        if (all_products[i].name === product) {
          pid = all_products[i].id;
          break;
        }
      }
      if (pid === undefined) {
        send_message("Oops! It seems that we don't have that product.", false);
        agent.add("Oops! It seems that we don't have that product.");
        return;
      }
    }

    let new_product = await get_product(pid);
    if (new_product === undefined) {
      send_message("Oops! It seems that we don't have that product.", false);
      agent.add("Oops! It seems that we don't have that product.")
    }

    let reviews = await get_reviews(pid);
    let max = 0;
    let min = 6;
    let top_review;
    let worst_review;
    let total = 0;
    for (let i = 0; i < reviews.length; i++) {
      total += reviews[i].stars;
      if (reviews[i].stars > max) {
        top_review = reviews[i];
        max = reviews[i].stars;
      }
      if (reviews[i].stars < min) {
        worst_review = reviews[i];
        min = reviews[i].stars;
      }
    }
    let avg = 0;
    let resp2 = "";
    let text_reviews = reviews.length > 1 ? "reviews" : "review";
    if (reviews.length > 0) {
      avg = total / reviews.length;
      resp2 = "This item has " + reviews.length + " " + text_reviews + " with an average rating of " + avg + " stars.";
      resp2 += "This is the review from our customer who rated this as high as " + top_review.stars + " stars: " + '"' + top_review.title + ". " + top_review.text + '"' + "."
      if (top_review.id != worst_review.id) {
        //resp2 += "This is the review from our customer who rated this as low as " + worst_review.stars + " stars: " + worst_review.title + ". " + worst_review.text + "."
      }
    }

    let good_responses_list = [
      "That's a nice one! ", "The reviews are maginificent! ", "People seem to like this one! "
    ]

    let nice_text = avg > 3 ? randomized_response(good_responses_list) : "";

    if (resp2 !== "") {
      send_message(nice_text + resp2, false);
      agent.add(nice_text + resp2);
    } else {
      send_message("Ummm.. This product has no review so far.", false);
      agent.add("Ummm.. This product has no review so far.");
    }
  }

  async function clear_cart_server() {
    let request = {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token
      }
    };
    const res = await fetch(ENDPOINT_URL + "/application/products", request);
    if (res.status != 200) {
      console.log(res.status + ": failed to clear the cart")
      return false;
    } else {
      return true;
    }
  }

  async function clear_cart() {
    send_message(agent.query, true);
    let success = await clear_cart_server();
    if (success) {
      let responses_list = [
        "Just cleared your shopping cart! Start fresh now.",
        "Look! I have cleared your cart.",
        "Cart cleared, captain!"
      ]
      let resp = randomized_response(responses_list);
      send_message(resp, false);
      agent.add(resp);
    } else {
      send_message("Oops! It seems that there is something wrong with our system. Please try again later.", false);
      agent.add("Oops! It seems that there is something wrong with our system. Please try again later.");
    }
  }

  async function confirm_and_purchase() {
    send_message(agent.query, true);
    let currPage = await get_current_page();
    if (!isNull(currPage)) {
      let splitted_url = currPage.split("/");
      if (splitted_url[splitted_url.length - 1] === "cart") {
        let success = await navigate_to_helper(username + "/cart-review");
        if (success) {
          let responses_list = [
            "Great! Just one more step. Confirm the purchase by clicking the confirm button, or you can always ask me.",
            "Ready to purchase? I need you to confirm the order by clicking the confirm button, or you can always ask me.",
            "Before we manage your order, please confirm the order by clicking the confirm button. I can also do that for you if you want me to."
          ]
          let resp = randomized_response(responses_list);
          send_message(resp, false);
          agent.add(resp);
        } else {
          send_message("Oops! It seems that there is something wrong with our system. Please try again later.", false);
          agent.add("Oops! It seems that there is something wrong with our system. Please try again later.");
        }
      } else if (splitted_url[splitted_url.length - 1] === "cart-review") {
        let success = await navigate_to_helper(username + "/cart-confirmed");
        if (success) {
          let responses_list = [
            "Yay! Your order has been placed. Thank you for your purchase!",
            "You are all set! Thank you for your purchase!",
            "Order up! Thank you for your purchase!"
          ]
          let resp = randomized_response(responses_list);
          send_message(resp, false);
          agent.add(resp);
        } else {
          send_message("Oops! It seems that there is something wrong with our system. Please try again later.", false);
          agent.add("Oops! It seems that there is something wrong with our system. Please try again later.");
        }
      } else {
        let page = "cart";
        success = await navigate_to_helper(username + "/" + page);
        if (!success) {
          send_message("Oops! You have to login first before accessing the page!", false);
          agent.add("Oops! You have to login first before accessing the page!");
        } else {
          let responses_list = [
            "Understood! We have arrived at " + page,
            "Here it is, we are at the " + page + " page.",
            "Heading to " + page + " right away, and here we are!"
          ]

          let resp = randomized_response(responses_list);
          send_message(resp, false);
          agent.add(resp);
        }
      }
    } else {
      send_message("Oops! It seems that there is something wrong with our system. Please try again later.", false);
      agent.add("Oops! It seems that there is something wrong with our system. Please try again later.");
    }
  }

  let intentMap = new Map()
  intentMap.set('Default Welcome Intent', welcome)
  intentMap.set('login', login)
  intentMap.set('navigate_to', navigate_to)
  intentMap.set('show_all_tags', show_all_tags)
  intentMap.set('navigate_to_and_filter', navigate_to_and_filter)
  intentMap.set('cart_info', cart_info)
  intentMap.set('add_to_cart', add_to_cart)
  intentMap.set('remove_from_cart', remove_from_cart)
  intentMap.set('product_info', product_info)
  intentMap.set('go_back', go_back)
  intentMap.set('product_rating', product_rating)
  intentMap.set('clear_cart', clear_cart)
  intentMap.set('confirm_and_purchase', confirm_and_purchase)
  agent.handleRequest(intentMap)
})

app.listen(process.env.PORT || 8080)
