var
express            = require('express'),
app                = express(),
server             = require('http').createServer(app),
io                 = require('socket.io').listen(server, {log: false}),
stylus             = require('stylus'),
_                  = require('underscore')



server.listen(8011);
console.log('Chat Server running on 8011');

function User(name){
	this.name = name || 'guest';
	this.id = '';
	this.room = 'default';
}


var users = []









// #########################################################################
// Error handler

	process.on('uncaughtException', function (exception) {
		// handle or ignore error
		console.log(exception);
	});


// #########################################################################
// Static Routes

	app.configure(function(){

		// Stylus
		app.use(stylus.middleware({
			src: __dirname + '/public',
			compress: true
		}));

		// Expose files in public directory
		app.use(express.static(__dirname + '/public'));

		return;

	})


// #########################################################################
// Routes

	app.get('/', function(req, res){
		res.sendfile(__dirname + '/public/index.html');
	});


// #########################################################################
// Sockets
	
	io.sockets.on('connection', function(socket){
		// clientside = /socket.io/socket.io.js
		console.log('Connection: ' + socket.id);
		console.log('');

		var user = new User();
		user.id = socket.id;
		users.push(user);
		socket.join(user.room);

		socket.emit('connected');

		info_client('Connected.');

		socket.on('set_name', function(data){
			user.name = data.name.substring(0,30).trim();
		})

		function info_all(message){
			io.sockets.emit('message', {
				level: 'info',
				content: message,
				user: user
			})
		}

		function info_room(message){
			io.sockets.emit('message', {
				level: 'info',
				content: message,
				room: user.room,
				user: user
			})
		}

		function info_client(message){
			socket.emit('message', {
				level: 'info',
				content: message,
				user: user
			})
		}

		function user_room(message){
			io.sockets.in(user.room).emit('message', {
				content: message,
				level: 'user',
				user: user
			});
		}

		function emote_room(message){
			io.sockets.in(user.room).emit('message', {
				content: user.name + ' ' + message,
				level: 'emote',
				user: user
			});
		}

		function pm_client(target_user, message){
			io.sockets.socket(target_user.id).emit('message', {
				content: message,
				level: 'pm',
				target: target_user,
				user: user
			});

			socket.emit('message', {
				content: message,
				level: 'pm',
				target: target_user,
				user: user
			});
		}

		function command_client(cmd, params){
			socket.emit('command', {
				command: cmd,
				params: params || [],
				user: user
			})
		}

		function command_room(cmd, params){
			io.sockets.in(user.room).emit('command', {
				command: cmd,
				params: params || [],
				user: user
			})
		}

		socket.on('send_message', function(data){
			user.last_msg = data.content;
			user.time = data.date;
			parse(data.content.replace(/\</, '&lt;').replace(/\>/, '&gt;'));

		})

		var commands = [
			{
				name: 'say',
				run: function(message){
					user_room(message);
				}
			},

			{
				name: 'name',
				run: function(value){
					var oldname = user.name;
					var newname = value.substring(0,30);

					user_room('/name '+newname);

					user.name = newname;
				}
			},

			{
				name: 'refresh',
				run: function(){
					command_room('refresh');
				}
			},

			{
				name: 'clearinfo',
				run: function(){
					command_client('clearinfo');
				}
			},

			{
				name: 'clear',
				run: function(){
					command_client('clear');
				}
			},

			{
				name: 'me',
				run: function(message){
					emote_room(message);
				}
			},

			{
				name: 'rooms',
				run: function(){
					var rooms = '';

					for(prop in io.sockets.manager.rooms){
						if(prop != '') rooms += prop.replace('/', '')+', ';
					}

					info_client('Rooms: ' + rooms.substring(0, rooms.length-2));
				}
			},

			{
				name: 'online',
				run: function(){
					var users_list = '';

					for(var i=-1; ++i<users.length;){
						users_list += users[i].name+', ';
					}

					info_client('Online users: ' + users_list.substring(0, users_list.length-2));
				}
			},

			{
				name: 'room',
				run: function(room){
					if(!room.trim()) room = 'default';
					socket.leave(user.room);
					socket.join(room.trim());
					user.room = room.trim();
					info_client('You changed to room '+room.trim())
				}
			},

			{
				name: 'pm',
				run: function(target_user, message){
					//console.log('Hey, \''+user+'\', '+message);
					//return 'pm to '+user+': '+message;
					//

					var target = _.find(users, function(i){
						if(i.name.toLowerCase() == target_user.toLowerCase()) return true;
					});

					if(typeof target != 'undefined'){
						pm_client(target, message);
					}else{
						info_client(target_user+' is not online, or doesn\'t exist');
					}
				}
			},

			{
				name: 'help',
				run: function(){
					info_client('Commands<br>\
						<div class="indent">\
							/help <span class="desc">- See this list of commands</span><br>\
							/clear <span class="desc">- Clear all messages</span><br>\
							/clearinfo <span class="desc">- Clear all the orange info messages and commands</span><br>\
							/name &lt;your name&gt; <span class="desc">- Change your name</span><br>\
							/online <span class="desc">- A list of all online users</span><br>\
							/rooms <span class="desc">- See a list of rooms</span><br>\
							/room &lt;room name&gt; <span class="desc">- Change to a room</span><br>\
							/me &lt;emote&gt; <span class="desc">- Emote, eg: John laughs</span><br>\
							/pm &lt;username&gt; &lt;message&gt; <span class="desc">- Send a private message to a user</span><br>\
							'+/*/r &lt;message&gt; <span class="desc">- Reply to the user that just sent you a private message</span><br>\
						*/'</div>\
					');
				}
			}
		];

		function parse(message){
			var command_found = false;

			for(var i=0; i<commands.length; i++){

				var cmd = commands[i];

				if(message.indexOf('/'+cmd.name) == 0){

					command_found = true;

					var command_length = cmd.name.length+2;

					if(cmd.run.length == 0){

						return cmd.run();

					}else if(cmd.run.length == 1){

						var param1= message.substring(command_length)
						return cmd.run(param1);

					}else if(cmd.run.length == 2){

						var param1 = message.split(' ')[1];
						var param2 = message.substring(message.indexOf(' ', param1.length + command_length)+1);

						return cmd.run(param1, param2);

					}
				}
			}
			if(!command_found){
				return commands[0].run(message);
			}
		}

		socket.on('disconnect', function(){
			console.log('Disconnection: '+socket.id);
			socket.broadcast.to(user.room).emit('disconnected', socket.id);

			var thisUser = _.find(users, function(user){
				if(user.id == socket.id) return true;
			});

			users = _.without(users, thisUser);
		});

	});



	