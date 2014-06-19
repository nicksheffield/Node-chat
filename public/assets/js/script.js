var message = $('#message'),
	chat = $('.chat'),
	msg_history = [],
	history_index = 0

$(document).click(function(e){

	if(e.clientY > message.offset().top){
		message.focus();
	}
	
})

if(!localStorage.name){
	chat.append('<div class="info name">What is your name?</div>');

	message.on('keyup', checkName);

	function checkName(e){
		if(e.which == 13 && message.val() != ''){
			localStorage.name = message.val();
			$('.info.name').remove();
			message.val('');
			message.off('keyup', checkName);
			start();
		}
	}
}else{
	start();
}

function start(){
	var socket = io.connect(location.origin+':8011')

	chat.append('<div class="info">Type /help for a list of commands.</div>');

	socket.on('connect', function(){
		console.log('connected');

		socket.emit('set_name', {name: localStorage.name});
	})

	socket.on('command', function(data){

		var exists = false;

		$('.message.pending').each(function(){
			var self = $(this),
				para = self.find('.content p');

			if(para.text() == data.user.last_msg){
				exists = self;
			}
		})

		if(exists){
			exists.removeClass('pending');
		}

		switch(data.command){
			case 'refresh':
				location.reload();
				break;

			case 'clear':
				chat.html('');
				break;

			case 'clearinfo':
				chat.find('.info').remove();
				chat.find('.content').each(function(){
					if($(this).text()[0] == '/'){
						$(this).parent().remove();
					}
				})
				break;
		}
	})

	socket.on('message', function(data){

		var exists = false;

		$('.message.pending').each(function(){
			var self = $(this),
				para = self.find('.content p');

			if(para.text() == data.user.last_msg){
				exists = self;
			}
		})

		if(exists){
			exists.removeClass('pending');
		}

		if(data.level == 'user'){
			var me = socket.socket.sessionid == data.user.id ? ' me ' : '';

			name = me ? '&gt;' : '&lt;'+data.user.name+'&gt;';

			if(!exists){
				var time = new Date(data.user.time);
				chat.append('\
					<div class="message '+me+'">\
						<span class="user" data-user="\
						'+data.user.name.substring(0,30)+'">'+name+'</span>\
						<span class="content"><p>'+data.content+'<span class="time">'+time.getHours()+':'+time.getMinutes()+'</span></p></span>\
					</div>\
				');
			}
			
		}else if(data.level == 'info'){
			chat.append('<div class="info">'+data.content+'</div>');
		}else if(data.level == 'pm'){
			chat.append('\
				<div class="message pm">\
					<span class="user" data-user="'+data.user.name+'">\
					'+data.user.name+'->'+data.target.name+'</span>\
					<span class="content"><p>'+data.content+'</p></span>\
				</div>\
			');
		}else if(data.level == 'emote'){
			chat.append('<div class="emote">'+data.content+'</div>');
		}
		
	})

	

	$(document).on('keydown', function(e){

		// pressed up
		if(e.which == 38){
			if(history_index != msg_history.length){
				history_index += 1;
				message.val(msg_history[msg_history.length - history_index]);
			}

			return false;
		}
		// pressed down
		if(e.which == 40){
			if(history_index != 0){
				history_index -= 1;
				message.val(msg_history[msg_history.length - history_index]);
			}
			
			return false;
		}
		// pressed enter
		if(e.which == 13){
			history_index = 0;
			var msg = message.val();
			if(msg.trim()) msg_history.push(msg);
			socket.emit('send_message', {
				content: msg,
				date: new Date()
			})

			message.val('');

			chat.append('\
				<div class="message pending me">\
					<span class="user" data-user="'+localStorage.name+'">&gt;</span>\
					<span class="content"><p>'+msg+'</p></span>\
				</div>\
			');

			if(msg.indexOf('/name ') == 0){
				localStorage.name = msg.substring(5).replace(/\n/, '').trim();
				console.log(localStorage.name);
			}
		}
	})


	
}


