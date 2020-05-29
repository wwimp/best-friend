// Solar.js
/*用于演示变换和坐标系
 画了一个简单的太阳系，包括一个太阳，一个地球和一个月球
 使用说明：
 *	  按"r"键来启动和停止动画
 *    按"s"键单步执行动画
 *    向上和向下箭头用于控制动画中每一帧的时间间隔,每次按键时间间隔乘2或除2)
 */
 
// 全局变量
var gl;						// WebGL上下文

var runAnimation = true;	// 控制动画运行和暂停
var singleStep = false;		// 控制单步执行模式开启和关闭

/*这3个变量控制动画的状态和速度*/
var hourOfDay = 0.0;		// 一天中的小时数，初始为0
var dayOfYear = 0.0;		// 一年中的天数，初始为0
var SunofYear = 0.0;
var hourOfDayX = 0.0;
var dayOfYearX = 0.0;
// 控制动画速度变量，表示真实时间1秒对应的程序逻辑中的小时数
var animationStep = 24.0; 

var mvpStack = [];  // 模视投影矩阵栈，用数组实现，初始为空
var matProj;	    // 投影矩阵

var u_MVPMatrix;	// Shader中uniform变量"u_MVPMatrix"的索引
var u_Color;		// Shader中uniform变量"u_Color"的索引

var numVertices;	// 一个球的顶点数
var spherePoints = [];	// 存放一个球的顶点坐标数组

// 用于生成一个中心在原点的球的顶点坐标数据(南北极在z轴方向)
// 返回值为球的顶点数，参数为球的半径及经线和纬线数
function buildSphere(radius, columns, rows){
	var vertices = []; // 存放不同顶点的数组

	for (var r = 0; r <= rows; r++){
		var v = r / rows;  // v在[0,1]区间
		var theta1 = v * Math.PI; // theta1在[0,PI]区间

		var temp = vec3(0, 0, 1);
		var n = vec3(temp); // 实现Float32Array深拷贝
		var cosTheta1 = Math.cos(theta1);
		var sinTheta1 = Math.sin(theta1);
		n[0] = temp[0] * cosTheta1 + temp[2] * sinTheta1;
		n[2] = -temp[0] * sinTheta1 + temp[2] * cosTheta1;
		
		for (var c = 0; c <= columns; c++){
			var u = c / columns; // u在[0,1]区间
			var theta2 = u * Math.PI * 2; // theta2在[0,2PI]区间
			var pos = vec3(n);
			temp = vec3(n);
			var cosTheta2 = Math.cos(theta2);
			var sinTheta2 = Math.sin(theta2);
			
			pos[0] = temp[0] * cosTheta2 - temp[1] * sinTheta2;
			pos[1] = temp[0] * sinTheta2 + temp[1] * cosTheta2;
			
			var posFull = mult(radius, pos);
			
			vertices.push(posFull);
		}
	}

	/*生成最终顶点数组数据(使用线段进行绘制)*/
	if(spherePoints.length > 0)
		spherePoints.length = 0; // 如果sphere已经有数据，先回收
	numVertices = rows * columns * 6; // 顶点数

	var colLength = columns + 1;
	for (var r = 0; r < rows; r++){
		var offset = r * colLength;

		for (var c = 0; c < columns; c++){
			var ul = offset  +  c;						// 左上
			var ur = offset  +  c + 1;					// 右上
			var br = offset  +  (c + 1 + colLength);	// 右下
			var bl = offset  +  (c + 0 + colLength);	// 左下

			// 由两条经线和纬线围成的矩形
			// 只绘制从左上顶点出发的3条线段
			spherePoints.push(vertices[ul]);
			spherePoints.push(vertices[ur]);
			spherePoints.push(vertices[ul]);
			spherePoints.push(vertices[bl]);
			spherePoints.push(vertices[ul]);
			spherePoints.push(vertices[br]);
		}
	}

	vertices.length = 0;
}

// 页面加载完成后会调用此函数，函数名可任意(不一定为main)
window.onload = function main(){
	// 获取页面中id为webgl的canvas元素
    var canvas = document.getElementById("webgl");
	if(!canvas){ // 获取失败？
		alert("获取canvas元素失败！"); 
		return;
	}
	
	// 利用辅助程序文件中的功能获取WebGL上下文
	// 成功则后面可通过gl来调用WebGL的函数
    gl = WebGLUtils.setupWebGL(canvas);    
    if (!gl){ // 失败则弹出信息
		alert("获取WebGL上下文失败！"); 
		return;
	}        

	/*设置WebGL相关属性*/
	// 设置视口，占满整个canvas
    gl.clearColor(0.0, 0.0, 0.0, 1.0); // 设置背景色为黑色
	gl.enable(gl.DEPTH_TEST);	// 开启深度检测
	gl.viewport(0, 0, canvas.width, canvas.height);
	// 设置投影矩阵：透视投影，根据视口宽高比指定视域体
	matProj = perspective(50.0, 		// 垂直方向视角
		canvas.width / canvas.height, 	// 视域体宽高比
		1.0, 							// 相机到近裁剪面距离
		30.0);							// 相机到远裁剪面距离
     
	/*初始化顶点坐标数据*/
	// 生成中心在原点半径为1,15条经线和纬线的球的顶点
	buildSphere(1.0, 15, 15);

	/*创建并初始化一个缓冲区对象(Buffer Object)，用于存顶点坐标*/
    var verticesBufferId = gl.createBuffer(); // 创建buffer
	// 将id为verticesBufferId的buffer绑定为当前Array Buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, verticesBufferId);
	// 为当前Array Buffer提供数据，传输到GPU
    gl.bufferData(gl.ARRAY_BUFFER, 	 // Buffer类型
		flatten(spherePoints), // Buffer数据源
		gl.STATIC_DRAW );  // 表明是一次提供数据，多遍绘制
	
	/*加载shader程序并为shader中attribute变量提供数据*/
	// 加载id分别为"vertex-shader"和"fragment-shader"的shader程序，
	// 并进行编译和链接，返回shader程序对象program
    var program = initShaders(gl, "vertex-shader", 
		"fragment-shader");
    gl.useProgram(program);	// 启用该shader程序对象 
	
	/*初始化顶点着色器中的顶点位置属性*/
	// 获取名称为"a_Position"的shader attribute变量的位置
    var a_Position = gl.getAttribLocation(program, "a_Position");
	if(a_Position < 0){ // getAttribLocation获取失败则返回-1
		alert("获取attribute变量a_Position失败！"); 
		return;
	}	
	// 指定利用当前Array Buffer为a_Position提供数据的具体方式
    gl.vertexAttribPointer(a_Position, 	// shader attribute变量位置
		3, // 每个顶点属性有3个分量
		gl.FLOAT, // 数组数据类型(浮点型)
		false, 	  // 不进行归一化处理
		0,	 	  // 相邻顶点属性首址间隔(0为紧密排列) 
		0);		  // 第一个顶点属性在Buffer中偏移量
    gl.enableVertexAttribArray(a_Position);  // 启用顶点属性数组

	/*获取shader中uniform变量索引*/
	u_MVPMatrix = gl.getUniformLocation(program, "u_MVPMatrix");
	if(!u_MVPMatrix){
		alert("获取uniform变量u_MVPMatrix失败！")
		return;
	}
	
	u_Color = gl.getUniformLocation(program, "u_Color");
	if(!u_Color){
		alert("获取uniform变量u_Color失败！")
		return;
	}
	
	// 进行绘制
    render();
};

// 按键响应
window.onkeydown = function(){
	switch(event.keyCode){
		case 82: // r/R键
			if (singleStep) {	// 如果之前为单步执行模式
				singleStep = false;	 // 结束单步执行
				runAnimation = true; // 重启动画
			}
			else {
				runAnimation = !runAnimation;// 切换动画开关状态
			}
			break;
		case 83: // s/S键
			singleStep = true;
			runAnimation = true;
			break;
		case 38: // Up键
			 animationStep *= 2.0;	// 加快动画速度
			 break;
		case 40: // Down键
			 animationStep /= 2.0;	// 减慢动画速度
			 break;
	}
}

// 记录上一次调用函数的时刻
var last = Date.now();

// 根据时间更新旋转角度
function animation(){
	// 计算距离上次调用经过多长的时间
	var now = Date.now();
	var elapsed = now - last; // 毫秒
	last = now;
	
	if (runAnimation) {	// 如果动画开启
		// 更新动画状态
		var hours = animationStep * elapsed / 1000.0; // 过去的小时数
        hourOfDay += hours;
        dayOfYear += hours / 24.0;
		
		SunofYear += hours/10;
		
		hourOfDayX +=hours;
		dayOfYearX +=hours/36.0;
		
		// 防止溢出
        hourOfDay %= 24;
        dayOfYear %= 365;
		hourOfDayX %=36;
		dayOfYearX %=300;
		
	}
}

// 绘制太阳系
// 参数为模视投影矩阵
function drawSolarSystem(mvp){
	/*下面开始构建整个太阳系，在世界坐标系下考虑问题*/
	// 注意缩放变换和地球系统无关，不应影响地球系统的绘制
	//第一个太阳
	mvpStack.push(mvp); // 将MVP矩阵压进栈
	mvp = mult(mvp, rotateY(360.0 * SunofYear / 365.0));
	mvp = mult(mvp,translate(1.5,0.0,0.0))
	mvp = mult(mvp, scale(0.8, 0.8, 0.8)); // 控制太阳大小的缩放变换
    // 太阳直接画在原点，无须变换，用一个黄色的球体表示
	gl.uniformMatrix4fv(u_MVPMatrix, false, flatten(mvp)); // 传模视投影矩阵
	gl.uniform3f(u_Color, 1.0, 1.0, 0.0 );  // 黄色
	gl.drawArrays(gl.LINES, 0, numVertices);
	mvp = mvpStack.pop(); // 出栈，此时针对太阳的缩放变换就不包含在mvp中了
	
	//第二个太阳
	mvpStack.push(mvp); // 将MVP矩阵压进栈
	mvp = mult(mvp, rotateY(360.0 * SunofYear / 365.0));
	mvp = mult(mvp,translate(-1.5,0.0,0.0))
	mvp = mult(mvp, scale(0.8, 0.8, 0.8)); // 控制太阳大小的缩放变换
    // 太阳直接画在原点，无须变换，用一个黄色的球体表示
	gl.uniformMatrix4fv(u_MVPMatrix, false, flatten(mvp)); // 传模视投影矩阵
	gl.uniform3f(u_Color, 1.0, 1.0, 0.0 );  // 黄色
	gl.drawArrays(gl.LINES, 0, numVertices);
	mvp = mvpStack.pop();
	
	
    /*对地球系统定位，绕太阳放置它*/
	// 用dayOfYear来控制其绕太阳的旋转
	mvpStack.push(mvp);
    mvp = mult(mvp, rotateY(360.0 * dayOfYear / 365.0));
	// 用于控制地球和太阳之间距离的平移变换
    mvp = mult(mvp, translate(3.5, 0.0, 0.0));

	// 绘制地球系统
	drawEarthSystem(mvp);
	mvp = mvpStack.pop();
	
	
	//X星球
	mvpStack.push(mvp);
	mvp = mult(mvp, rotateY(360.0 * dayOfYearX / 300.0));
	// 用于控制地球和太阳之间距离的平移变换
    mvp = mult(mvp, translate(6.0, 0.0, 0.0));

	// 绘制地球系统
	drawXSystem(mvp);
	mvp = mvpStack.pop();

	
}

// 绘制地球系统
// 参数为模视投影矩阵
function drawEarthSystem(mvp){
	/*下面开始在地球系统的小世界坐标系下考虑问题*/
	// 绘制地球，地球的缩放和自转不应该影响月球
    mvpStack.push(mvp); // 保存矩阵状态
	// 地球自转，用hourOfDay进行控制
	mvp = mult(mvp,rotateY(-40));
	mvp = mult(mvp,rotateZ(-40));
	mvp = mult(mvp,rotateY(360.0 * hourOfDay / 24.0));
	mvp = mult(mvp, scale(0.4, 0.4, 0.4));// 控制地球大小的缩放变换
	// 画一个蓝色的球来表示地球
	gl.uniformMatrix4fv(u_MVPMatrix, false, flatten(mvp)); // 传模视投影矩阵
	gl.uniform3f(u_Color, 0.0, 0.5, 1.0 );  // 蓝色
	mvp = mult(mvp,rotateX(90));
	gl.drawArrays(gl.LINES, 0, numVertices);
	mvp = mvpStack.pop(); // 恢复矩阵状态
	
	
	mvpStack.push(mvp);
	mvp = mult(mvp,rotateY(-40));
	mvp = mult(mvp,rotateZ(-40));
	mvp = mult(mvp, rotateY(360.0 * 12.0 * dayOfYear / 365.0));
	// 用于控制月球和地球距离的平移变换
    mvp = mult(mvp, translate(0.7, 0.0, 0.0));
	moon(mvp);
	mvp = mvpStack.pop();
}
function moon(mvp){
	/*画月球*/
	mvpStack.push(mvp); // 保存矩阵状态
	// mvp = mult(mvp,rotateY(-40));
	// 用dayOfYear来控制其绕地球的旋转
	// mvp = mult(mvp,rotateZ(-40));
  	mvp = mult(mvp, rotateY(360.0 * 12.0 * dayOfYear / 365.0));
	// 用于控制地月距离的平移变换
    // mvp = mult(mvp, translate( 0.7, 0.0, 0.0 ));
	mvp = mult(mvp, scale(0.1, 0.1, 0.1));// 控制月球大小的缩放变换
	gl.uniformMatrix4fv(u_MVPMatrix, false, flatten(mvp)); // 传模视投影矩阵
	gl.uniform3f(u_Color, 0.74, 0.74, 0.74 );
	mvp = mult(mvp,rotateX(90));	
	gl.drawArrays(gl.LINES, 0, numVertices);
	mvp = mvpStack.pop(); // 恢复矩阵状态
	
	//月球卫星
	mvpStack.push(mvp); // 保存矩阵状态
	// mvp = mult(mvp,rotateY(-40));
	// mvp = mult(mvp,rotateZ(-40));
	// 用dayOfYear来控制其绕地球的旋转
  	mvp = mult(mvp, rotateY(360.0 * 12.0 * 4*dayOfYear / 365.0));
	// 用于控制地月距离的平移变换
    mvp = mult(mvp, translate( 0.2, 0.0, 0.0 ));
	mvp = mult(mvp, scale(0.05, 0.05, 0.05));// 控制月球大小的缩放变换
	gl.uniformMatrix4fv(u_MVPMatrix, false, flatten(mvp)); // 传模视投影矩阵
	gl.uniform3f(u_Color, 0.8, 0.7, 0.3 ); 
	mvp = mult(mvp,rotateX(90));
	gl.drawArrays(gl.LINES, 0, numVertices);
	mvp = mvpStack.pop(); // 恢复矩阵状态
}
function drawXSystem(mvp){
	/*下面开始在地球系统的小世界坐标系下考虑问题*/
	// 绘制地球，地球的缩放和自转不应该影响月球
    mvpStack.push(mvp); // 保存矩阵状态
	// 地球自转，用hourOfDay进行控制
	mvp = mult(mvp, rotateY(360.0 * hourOfDayX / 36.0));
	mvp = mult(mvp, scale(0.4, 0.4, 0.4));// 控制X大小的缩放变换
	// 画一个red的球来表示X
	gl.uniformMatrix4fv(u_MVPMatrix, false, flatten(mvp)); // 传模视投影矩阵
	gl.uniform3f(u_Color, 0.1, 0.1, 0.1 );  // 红色
	gl.drawArrays(gl.LINES, 0, numVertices);
	mvp = mvpStack.pop(); // 恢复矩阵状态

	/*第一个卫星*/
	mvpStack.push(mvp); // 保存矩阵状态

	// 用dayOfYear来控制其绕地球的旋转
  	mvp = mult(mvp, rotateY(360.0 * hourOfDayX / 36.0));
	// 用于控制地月距离的平移变换
    mvp = mult(mvp, translate( 0.55, 0.0, 0.0 ));
	mvp = mult(mvp, scale(0.1, 0.1, 0.1));// 控制月球大小的缩放变换
	gl.uniformMatrix4fv(u_MVPMatrix, false, flatten(mvp)); // 传模视投影矩阵
	gl.uniform3f(u_Color, 1.0, 0.9, 0.14 ); 
	gl.drawArrays(gl.LINES, 0, numVertices);
	mvp = mvpStack.pop(); // 恢复矩阵状态
	//第二个卫星
	mvpStack.push(mvp); // 保存矩阵状态

	mvp = mult(mvp, rotateY(360.0 * 12.0 * dayOfYearX / 360.0));
	// 用于控制地月距离的平移变换
    mvp = mult(mvp, translate( -0.85 ,0.0, 0.0 ));
	mvp = mult(mvp, scale(0.1, 0.1, 0.1));// 控制月球大小的缩放变换
	gl.uniformMatrix4fv(u_MVPMatrix, false, flatten(mvp)); // 传模视投影矩阵
	gl.uniform3f(u_Color, 0.5, 0.5, 0.8 ); 
	gl.drawArrays(gl.LINES, 0, numVertices);
	mvp = mvpStack.pop(); // 恢复矩阵状态

}
// 绘制函数
function render() {
	// 更新动画相关参数
	animation();
	
	// 清颜色缓存和深度缓存
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
   
	var mvp = matProj;	// 定义模视投影矩阵，初始化为投影矩阵
	
	// 在观察坐标系(照相机坐标系)下思考，
	// 定位整个场景(第一种观点)或世界坐标系(第二种观点)
	// 向负z轴方向平移8个单位
    // mvp = mult(mvp, translate(0.0, 0.0, -8.0));

	// 将太阳系绕x轴旋转15度以便在xy-平面上方观察
	mvp = mult(mvp, lookAt(vec3(7,7,7),vec3(1,1,1),vec3(0,1,0)));
	
	// 绘制太阳系
	drawSolarSystem(mvp);
	
	// 如果是单步执行，则关闭动画
	if (singleStep) {	 				
		runAnimation = false;
	}
	
	requestAnimFrame(render); // 请求重绘
}
