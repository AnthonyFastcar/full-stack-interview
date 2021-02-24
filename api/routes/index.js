const { createMuiTheme } = require('@material-ui/core'),
  express = require('express'),
  router = express.Router(),
  { Pool, Client } = require('pg'),
  fs = require('fs'),
  configs = JSON.parse(fs.readFileSync('./serverConfig.json')),
  pool = new Pool({
    user: configs.user,
    host: configs.host,
    database: configs.database,
    password: configs.password,
    port: configs.port,
  });

router.get('/', async (req, res, next) => {
  try {
    res.send('ok!');
  } catch (err) {
    throw err.message;
  }

});

/* get list of robots */ 
router.get('/robot/list', async (req, res, next) => {
  const client = await pool.connect()
  try {
    let result = await client.query(`SELECT * FROM public.robots`);
    await client.query('COMMIT')
    // console.log('result.rows', result.rows);
    res.send(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err.message;
  }
});

/* get list of robots currently fighting */ 
router.get('/robot/fighting/list', async (req, res, next) => {
  const client = await pool.connect()
  try {
    let result = await client.query(`SELECT * FROM public.robots where infight = true`);
    await client.query('COMMIT')
    // console.log('result.rows', result.rows);
    res.send(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err.message;
  }
});

/* get list of robots not fighting */ 
router.get('/robot/sidline/list', async (req, res, next) => {
  const client = await pool.connect()
  try {
    let result = await client.query(`SELECT * FROM public.robots where infight = false`);
    await client.query('COMMIT')
    // console.log('result.rows', result.rows);
    res.send(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err.message;
  }
});

/* get list of robot classes */ 
router.get('/class/list', async (req, res, next) => {
  const client = await pool.connect()
  try {
    let result = await client.query(`SELECT * FROM public.classes`);
    await client.query('COMMIT')
    // console.log('result.rows', result.rows);
    res.send(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err.message;
  }
});

/* Get robot by id */
router.get('/robot/:id', async (req, res, next) => {
  let robotID = req.params.id;
  const client = await pool.connect();
  try {
    if(!robotID)
      throw 'No ID provided. Cannot get specific robot.'
      
    let result = await client.query(`SELECT * FROM public.robots WHERE robotid = ${robotID}`);
    await client.query('COMMIT')
    // console.log('result.rows', result.rows);
    res.send(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err.message;
  }
});

/* Create robot */ 
router.post('/robot', async (req, res, next) => {
  const client = await pool.connect()
  try {
    let data = req.body;
    if(!data)
      throw 'No data provided. Cannot create robot.'

    let result = await client.query(`INSERT INTO public.robots(name,color, attack, defense, health, numberofwins, numberoflosses, classid) 
      VALUES('${data.name}','${data.color}',${data.attack},${data.defense},${data.health},${data.numberofwins},${data.numberoflosses},${data.classid})`);
    await client.query('COMMIT')
    // console.log('result.rows', result.rows);
    res.send(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err.message;
  }
});

/* Update Robot */ 
router.put('/robot', async (req, res, next) => {
  let data = req.body;
  const client = await pool.connect()
  try {
    if(!data)
      throw 'No data provided. Cannot update robot.'

    let result = await client.query(`UPDATE public.robots
      SET color = '${data.color}', 
        attack = ${data.attack}, 
        defense = ${data.defense}, 
        health = ${data.health}, 
        classid = ${data.classid}
      WHERE robotid = ${data.robotid}`);
    await client.query('COMMIT')
    // console.log('result.rows', result.rows);
    res.send(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err.message;
  }
});

/* Delete Robot */
router.delete('/robot/:id', async (req, res, next) => {
  let robotID = req.params.id;
  const client = await pool.connect()
  try {
    if(!robotID)
      throw 'No ID provided. Cannot delete robot.'

    let result = await client.query(`DELETE FROM public.robots WHERE robotid = ${robotID}`);

    await client.query('COMMIT')

    res.send(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err.message;
  }
});

/* Tell me rule number one */
router.post('/robot/fightclub', async (req, res, next) => {
  /* variables */
  const client = await pool.connect();
  let data = req.body,
    robotArr = [],
    defeatedCounter = 0,
    defeatedArr =[],
    victorArr = [],
    result = [];

  try {
    if(!data)
      throw 'Cannot fight your robots!'

    /* Loop through and get bot information */  
    for(let bot of data){
      let robot = await client.query(`SELECT * FROM public.robots WHERE robotid = ${bot}`);
      robotArr.push(robot.rows[0]);
    }  
    
    /* Get class modifiers and add them to robots attack,defense, and health */
    for(let nano of robotArr){
      let classInfo = await client.query(`SELECT * FROM public.classes WHERE classid = ${nano.classid}`);
      nano.attack = nano.attack + classInfo.rows[0].attackmodifier;
      nano.defense = nano.defense + classInfo.rows[0].defensemodifier;

      /* Accidental healing occuring. Come back and fix later */
      nano.health = ( !nano.infight && nano.health >= 1 ? nano.health + classInfo.rows[0].healthmodifier : nano.health);

      if(!nano.infight){
        await client.query(`UPDATE public.robots 
            SET infight = true
            WHERE robotid = ${nano.robotid}`);
      }
    }

    /* Define variable for targeting robots */
    let target = 0;
    
    for(let fighter in robotArr){
      /* Randomly target a bot from all available robots. */
      target = (Math.floor(Math.random() * robotArr.length));
      /* Make sure robot does not hit itself */
      if(parseInt(fighter) !== target){
        // check to make sure the robot is still alive and if its check to see if it's attack can get through the targets defense. Additionally make sure they do not keep hitting dead robot.
        if(robotArr[fighter].health > 0 && robotArr[target].health > 0 && robotArr[fighter].attack >= robotArr[target].defense){
          let newHealth = robotArr[target].health - (Math.floor(Math.random() * 6) + 1);
          await client.query(`UPDATE public.robots 
            SET health = ${newHealth}
            WHERE robotid = ${robotArr[target].robotid}`);
            robotArr[target].health = newHealth;
            console.log('robot ' + robotArr[target].robotid + ' hit! Health is now ' + newHealth);
        }
      }
    }

    /* check to see if fight is over. If it is create battle history return the winning robot. Additinally reset in fight flag */
    for(let contestant of robotArr){
      if(contestant.health <= 0){
        defeatedCounter++
        defeatedArr.push(contestant);
      }
      else{
        victorArr.push(contestant);
      }
    }

    /* There can only be one! */
    if(victorArr.length === 1){
      result = victorArr;
      await client.query(`UPDATE public.robots 
            SET infight = false
            WHERE robotid = ${victorArr[0].robotid}`);

      for(let fallen of defeatedArr){
        await client.query(`INSERT INTO public.battlehistory(victorid, loserid, battledatetime)
          VALUES(${victorArr[0].robotid},${fallen.robotid},CURRENT_TIMESTAMP)`); 
          
          await client.query(`UPDATE public.robots 
            SET infight = false
            WHERE robotid = ${fallen.robotid}`);
      }
      
    }else{
      result = ['Fight in progress'];
    }

    await client.query('COMMIT')
    // console.log('result.rows', result.rows);
    res.send(result);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err.message;
  }
});

/* Get all battle history */
router.get('/battlehistory/list', async (req, res, next) => {
  const client = await pool.connect()
  try {
    let result = await client.query(`SELECT * FROM public.battlehistory`);
    await client.query('COMMIT')
    // console.log('result.rows', result.rows);
    res.send(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err.message;
  }
});

/* Get all battle history for a specfic victor */
router.get('/battlehistory/victor/:id', async (req, res, next) => {
  let robotID = req.params.id;
  const client = await pool.connect();
  try {
    if(!robotID)
      throw 'No ID provided. Cannot get specific robot.'
      
    let result = await client.query(`SELECT * FROM public.battlehistory WHERE victorid = ${robotID}`);
    await client.query('COMMIT')
    // console.log('result.rows', result.rows);
    res.send(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err.message;
  }
});

/* Get all battle history for a specfic looser */
router.get('/battlehistory/loser/:id', async (req, res, next) => {
  let robotID = req.params.id;
  const client = await pool.connect();
  try {
    if(!robotID)
      throw 'No ID provided. Cannot get specific robot.'
      
    let result = await client.query(`SELECT * FROM public.battlehistory WHERE loserid = ${robotID}`);
    await client.query('COMMIT')
    // console.log('result.rows', result.rows);
    res.send(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err.message;
  }
});

module.exports = router;
