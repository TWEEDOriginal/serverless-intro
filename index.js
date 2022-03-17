const AWS = require("aws-sdk");
AWS.config.update({
  //This is not necessary in our case because the dynamoDB region is same as lambda region
  region: "eu-central-1",
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const dynamodb_table_name = "product-inventory";
const health_path = "/health";
const product_path = "/product";
const products_path = "/products";

exports.handler = async (event) => {
  console.log("Request event: ", event);
  let response;
  switch (true) {
    case event.httpMethod === "GET" && event.path === health_path:
      response = buildResponse(200);
      break;
    case event.httpMethod === "GET" && event.path === product_path:
      response = await getProduct(event.queryStringParameters.productId);
      break;
    case event.httpMethod === "GET" && event.path === products_path:
      response = await getProducts();
      break;
    case event.httpMethod === "POST" && event.path === product_path:
      response = await saveProduct(JSON.parse(event.body));
      break;
    case (event.httpMethod === "PATCH" || event.httpMethod === "PUT") &&
      event.path === product_path:
      const { productId, updateKey, updateValue } = JSON.parse(event.body);
      response = await modifyProduct(productId, updateKey, updateValue);
      break;
    case event.httpMethod === "DELETE" && event.path === product_path:
      response = await deleteProduct(JSON.parse(event.body).productId);
      break;
    default:
      response = buildResponse(404, "404 Not Found");
  }
  return response;
};

async function getProduct(productId) {
  const params = {
    TableName: dynamodb_table_name,
    Key: {
      productId: productId,
    },
  };
  return await dynamodb
    .get(params)
    .promise()
    .then(
      (response) => {
        return buildResponse(200, response.Item);
      },
      (error) => {
        console.error(
          "Do your custom error handling here. I am just gonna log it: ",
          error
        );
      }
    );
}

async function getProducts() {
  const params = {
    TableName: dynamodb_table_name,
  };
  const allProducts = await scanDynamoRecords(params, []);
  const body = {
    products: allProducts,
  };
  return buildResponse(200, body);
}

async function scanDynamoRecords(scanParams, itemArray) {
  try {
    const dynamoData = await dynamodb.scan(scanParams).promise();
    itemArray = itemArray.concat(dynamoData.Items);
    if (dynamoData.LastEvaluatedKey) {
      scanParams.ExclusiveStartkey = dynamoData.LastEvaluatedKey;
      return await scanDynamoRecords(scanParams, itemArray);
    }
    return itemArray;
  } catch (error) {
    console.error(
      "Do your custom error handling here. I am just gonna log it: ",
      error
    );
  }
}

async function saveProduct(requestBody) {
  const params = {
    TableName: dynamodb_table_name,
    Item: requestBody,
  };
  return await dynamodb
    .put(params)
    .promise()
    .then(
      () => {
        const body = {
          Operation: "SAVE",
          Message: "SUCCESS",
          Item: requestBody,
        };
        return buildResponse(200, body);
      },
      (error) => {
        console.error(
          "Do your custom error handling here. I am just gonna log it: ",
          error
        );
      }
    );
}

async function modifyProduct(productId, updateKey, updateValue) {
  const params = {
    TableName: dynamodb_table_name,
    Key: {
      productId: productId,
    },
    UpdateExpression: `set ${updateKey} = :value`,
    ExpressionAttributeValues: {
      ":value": updateValue,
    },
    ReturnValues: "UPDATED_NEW",
  };
  return await dynamodb
    .update(params)
    .promise()
    .then(
      (response) => {
        const body = {
          Operation: "UPDATE",
          Message: "SUCCESS",
          UpdatedAttributes: response,
        };
        return buildResponse(200, body);
      },
      (error) => {
        console.error(
          "Do your custom error handling here. I am just gonna log it: ",
          error
        );
      }
    );
}

async function deleteProduct(productId) {
  const params = {
    TableName: dynamodb_table_name,
    Key: {
      productId: productId,
    },
    ReturnValues: "ALL_OLD",
  };
  return await dynamodb
    .delete(params)
    .promise()
    .then(
      (response) => {
        const body = {
          Operation: "DELETE",
          Message: "SUCCESS",
          Item: response,
        };
        return buildResponse(200, body);
      },
      (error) => {
        console.error(
          "Do your custom error handling here. I am just gonna log it: ",
          error
        );
      }
    );
}

function buildResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}
