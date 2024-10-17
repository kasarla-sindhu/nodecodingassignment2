const express = require('express')
const app = express()
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const path = require('path')
const dbPath = path.join(__dirname, 'twitterClone.db')
const bcrypt = require('bcrypt')
let db = null
app.use(express.json())
const jwt = require('jsonwebtoken')

const initializeserverAndDb = async (req, res) => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running on Port 3000')
    })
  } catch (e) {
    console.log(`DB Error ${e.message}`)
  }
}

initializeserverAndDb()

const authUser = async (req, res, next) => {
  let jwttoken
  const authHeader = req.headers['authorization']
  if (authHeader !== undefined) {
    jwttoken = authHeader.split(' ')[1]
  }
  if (jwttoken === undefined) {
    res.status(401)
    res.send('Invalid JWT Token')
  } else {
    jwt.verify(jwttoken, 'secret_token', async (error, payload) => {
      if (error) {
        res.status(401)
        res.send('Invalid JWT Token')
      } else {
        req.userIs = payload.username
        next()
        return
      }
    })
  }
}

app.post('/register/', async (req, res) => {
  const {username, password, name, gender} = req.body
  const hashedpassword = await bcrypt.hash(password, 10)
  const userQuery = `SELECT * FROM user WHERE username='${username}'`
  const userDetails = await db.get(userQuery)
  if (userDetails === undefined) {
    if (password.length >= 6) {
      const query = `
        INSERT INTO 
        user(name,username,password,gender) 
        VALUES ('${name}','${username}','${hashedpassword}','${gender}')`
      await db.run(query)
      res.status(200)
      res.send('User created successfully')
    } else {
      res.status(400)
      res.send('Password is too short')
      return
    }
  } else {
    res.status(400)
    res.send('User already exists')
    return
  }
})

app.post('/login/', async (req, res) => {
  const {username, password} = req.body
  const query = `SELECT *
  FROM user WHERE username='${username}'`
  const userDetails = await db.get(query)
  if (userDetails === undefined) {
    res.status(400)
    res.send('Invalid user')
  } else {
    const ispasswordmatched = await bcrypt.compare(
      password,
      userDetails.password,
    )
    if (ispasswordmatched) {
      const payload = {
        username: userDetails.username,
      }
      const jwtToken = jwt.sign(payload, 'secret_token')
      res.send({jwtToken})
    } else {
      res.status(400)
      res.send('Invalid password')
    }
  }
})

app.get('/user/tweets/feed/', authUser, async (req, res) => {
  const {userIs} = req
  const q = `
  SELECT user_id
  FROM user
  WHERE username='${userIs}'`
  const userId = await db.get(q)
  const {user_id} = userId
  console.log(user_id)
  const q2 = `
  SELECT *
  FROM user INNER JOIN follower ON user.user_id=follower.following_user_id`
  /* const q2 = `
  SELECT username , tweet, date_time AS dateTime
  FROM (follower INNER JOIN user ON follower.following_user_id=user.user_id) AS T INNER JOIN tweet ON T.user_id=tweet.user_id
  LIMIT 4` */
  const result = await db.all(q2)
  res.send(result)
})

//API 4
app.get('/user/following/', authUser, async (req, res) => {
  const {userIs} = req
  const q = `
  SELECT user_id
  FROM user
  WHERE username='${userIs}'`
  const userId = await db.get(q)
  const {user_id} = userId
  console.log(user_id)
  const q2 = `
  SELECT  user.name 
  FROM user INNER JOIN follower ON user.user_id=follower.following_user_id
  WHERE follower.follower_user_id=${user_id}
  `
  const result = await db.all(q2)
  res.send(result)
})

//API 5
app.get('/user/followers/', authUser, async (req, res) => {
  const {userIs} = req
  const q = `
  SELECT user_id
  FROM user
  WHERE username='${userIs}'`
  const userId = await db.get(q)
  const {user_id} = userId
  console.log(user_id)
  const q2 = `
  SELECT  user.name 
  FROM user INNER JOIN follower ON user.user_id=follower.follower_user_id
  WHERE follower.following_user_id=${user_id}
  `
  const result = await db.all(q2)
  res.send(result)
})

//API 6
app.get('/tweets/:tweetId/', authUser, async (req, res) => {
  const {userIs} = req
  const q = `
  SELECT user_id
  FROM user
  WHERE username='${userIs}'`
  const userId = await db.get(q)
  const {user_id} = userId
  const {tweetId} = req.params
  const q2 = `
  SELECT *
  FROM (user INNER JOIN follower ON user.user_id=follower.following_user_id) AS T INNER JOIN tweet ON T.user_id=tweet.user_id
  WHERE follower.follower_user_id=${user_id} AND tweet.tweet_id=${tweetId}
  `
  const resultis = await db.all(q2)
  res.send(resultis)
})

//API 9
app.get('/user/tweets/', authUser, async (req, res) => {
  const {userIs} = req
  const q = `
  SELECT user_id
  FROM user WHERE 
  username='${userIs}'`
  const userId = await db.get(q)
  const {user_id} = userId
  const q2 = `
  SELECT tweet.tweet , count(like.like_id) AS likes , count(reply.reply) AS replies, tweet.date_time
  FROM (tweet INNER JOIN reply ON tweet.tweet_id=reply.tweet_id) AS T INNER JOIN like ON T.tweet_id=like.tweet_id
  WHERE tweet.user_id=${user_id}
  GROUP BY tweet.tweet_id `
  const resultIs = await db.all(q2)
  res.send(resultIs)
})

module.exports = app
