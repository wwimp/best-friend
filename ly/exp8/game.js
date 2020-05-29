var btn = document.querySelector('button');
var z= 300.00;
var sec = document.getElementById('sec');
var uls = document.querySelector('ul');
var list1 = document.getElementsByClassName('list1')[0];
var score = document.getElementById('score');
var level=1;
var n=0;
var back = document.getElementById('back');
btn.onclick=function(){
	var timer = setInterval(function(){
		z -=0.01;
		z = z.toFixed(2);
		sec.innerHTML = z;
		if(z<=0){
			clearInterval(timer);
			if(n<8){
				alert("GAME OVER!"+' ' +'等级：您猜怎么着？近视200来度~');
			}
			else if(n<12){
				alert("GAME OVER!"+' ' +'等级：介眼力劲儿~算凑合~');
			}
			else if(n<=20){
				alert("GAME OVER!"+' ' +'等级：这眼力，那叫一地道~');
			}
			else {
				alert("GAME OVER!"+' ' +'等级：嗬~盖了帽了！');
			}
			back.style.display='block';
		}
	},10);
	btn.remove();
	list1.remove();
	app();
	function app(){
		level+=1;
		
		for(var i = 0;i<level*level;i++){
			var newLi = document.createElement('li');
			uls.appendChild(newLi);
			var newImg = document.createElement('img');
			newLi.appendChild(newImg);
			newLi.style.width = 100/level+'%';
			newLi.style.float = 'left';
			newImg.style.display = 'block';
			newImg.style.width = 100+'%';
			newImg.src = 'img/3.png';
			
		newLi.style.backgroundColor='rgb('+rand(50,255)+','+rand(50,255)+','+rand(50,255)+')';
		
		}
		var x=rand(0,level*level-1);
		var imgs1 = document.querySelectorAll('img');
		imgs1[x].src = 'img/4.png';
		var li = document.querySelectorAll('li');
		li[x].onclick=function(){
			for(var i = 0;i<level*level;i++){
				li[i].remove(this);
			}
			n+=1;
			score.innerHTML = n;
			if(level>10){
				level = 10;
			}
			app();
		}
	}
}
function rand(min,max){
	return Math.round(Math.random()*(max-min)+min);
}