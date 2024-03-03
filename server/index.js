import express from 'express';
import logger from 'morgan';
import dotenv from 'dotenv'; //! va de la mano con la librería que hemos instalado npm install @libsql/client dotenv
import { createClient } from '@libsql/client';//! hemos instalado la librería para poder usar un sql lite online como es turso: npm install @libsql/client dotenv(el dotenv al final es para poder usar las variables de entorno, no sé muy bien para que)

import { Server } from 'socket.io'; //! Para importar la librería de socket.io: npm install socket.io -E(el -E es para instalar una versión exacta)
import { createServer } from 'node:http'; //! nos permite crear servidores http

dotenv.config();

const port = process.env.PORT ?? 1234;

const app = express(); //! Nuestra aplicación es un servidor http(con funciones a medias). pero queremos agregarle toas la funcionales de un socket IO(in out)
const server = createServer(app) //! creando el servidor http total

const io = new Server(server, {
    connectionStateRecovery: {
        maxDisconnectionDuration: 12000 //! establece el tiempo para recuperar los mensajes cuándo estás desconectado
    }
});

//! estamos usando el sql liete de turso, ver la url de la base de datos y el auth en la misma página dónde la haz creado: https://turso.tech/app
//! podemos usar el turso cli, solo que mi máquina no la soporta, para ello debemos intalar el wsl(línea de comandos del entorno de linux en windows)
const db = createClient({
  url: "libsql://chat-nodejs-websocket-srenc90.turso.io",
  authToken: process.env.DB_TOKEN,
});

//! creando la tabla
await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        user TEXT
    )
`)


io.on('connection', async (socket) => {
    console.log('An user has connected!');

    socket.on('disconnect', () => {
        console.log('An user has disconnnected')
    })

    socket.on('chat message', async (msg) => {
        let result;
        const username = socket.handshake.auth.username ?? 'anonymous'
        try {
            result = await db.execute({
                sql: 'INSERT INTO messages (content, user) VALUES (:message, :username)',
                // args: {message: msg, username}
                args: {message: msg, username: username}
            })
        } catch (error) {
            console.error(error);
            return;
        }
        // console.log('message:' + msg);
        //! el socket.emit emite a nivel de una conexión en cambio io.emit emite para todas las conexiones
        io.emit('chat message', msg, result.lastInsertRowid.toString(), username); //! observa que hemos cambiado no es socket.emit, sino io.emit para poder hacer un bradcast (emitir a todo el mundo)
    })

    console.log('auth ⬇⬇⬇⬇⬇⬇');
    console.log(socket.handshake.auth); //! el socket.handshake es un propiedad proporcionada por la librería de socket, este te permite acceder a los datos envíos por parte del cliente(en este caso estamos accediendo a la propiedad auth) cuándo se inicia la conexión a través del socket.

    if(!socket.recovered) { //! si no se han recuperado los mensajes (sin conexión, etc)
        try {
            const result = await db.execute({
                sql: 'SELECT id, content, user FROM messages where id > ?',
                args: [socket.handshake.auth.serverOffset ?? 0]
            })

            result.rows.forEach(row => {
                socket.emit('chat message', row.content, row.id.toString(), row.user);
            })
        } catch (error) {
            console.log(error);
        }
    }
})

app.use(logger('dev'));

app.get('/', (req, res) => { //! En esta ruta lo que indicamos es que si el usuario navega a la página principal respondemos con una función o callback
    // res.send('<h1>Esto es el chat</h1>')
    res.sendFile(process.cwd() + '/client/index.html');//! la respuesta va a traer el archivo que estamos trabajando que es el index.html, el process.cwd(cwd = current working directory) lo que hace es que trae la ruta dónde está el proyecto y a eso le concatenamos a dónde queremos que apuente
})

// app.listen(port, () => { //! ya no vamos a estar escuchando la aplicación, sino el servidor
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
})

/*
 * Pasos para crear un proyecto en node express
 * 1. npm init -y Iniciar un proyecto en nodejs(Tienes que estar en la carpeta dónde quieres crear el proyecto) el -y es para indicar yes a las consultas que te hagan al crear el proyecto
 * 2. npm install express -E(el -E es para instalar un versión específica de node y no colocar ˆ1... ) Instalar el framework de express
 * 3. Para utilizar el import {} from '' de ESModule debemos colocar en el package.json: "type": "module"
 * 4. Colocamos en el package.json en la sección de scripts: "dev":"node --watch ./server/index.js" y para correr el proyecto solamente colcamos npm run dev(el nombre que hemos colocado a nuestro script)
 * 5. Instalamos Morgan para tener un log en consola de cuándo se realiza una request a nuestros recursos node install morgan -E
*/