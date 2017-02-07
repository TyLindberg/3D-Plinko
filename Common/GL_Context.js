// *******************************************************
// CS 174a Graphics Example Code
// GL_Context - This class performs all the setup of doing graphics.   It informs OpenGL of which functions to call during events - such as a key getting pressed or it being time to redraw.  
// It also displays any strings requested, and the key controls. 

// First, a small structure for holding all the global attributes of your scene:
function GraphicsState( camera_transform, projection_transform, animation_time )
	{	this.camera_transform = camera_transform;	this.projection_transform = projection_transform;	this.animation_time = animation_time;	this.lights = []; }

function Light( pos, color, size ) {	this.position = pos;	this.color = color;	this.attenuation = 1/size; }
   
function Graphics_Addresses( program )		// Find out the memory addresses internal to the graphics card of each of its variables, and store them here locally for the Javascript to use
  {	
		function Shader_Attribute( index, size, type, enabled, normalized, stride, pointer )
			{	this.index = index; this.size = size; this.type = type; this.enabled = enabled; this.normalized = normalized; this.stride = stride; this.pointer = pointer;	};

    this.shader_attributes = [ 	new Shader_Attribute( gl.getAttribLocation( program, "vPosition"), 3, gl.FLOAT, true, false, 0, 0 ),
                                new Shader_Attribute( gl.getAttribLocation( program, "vNormal"), 3, gl.FLOAT, true, false, 0, 0 ),
                                new Shader_Attribute( gl.getAttribLocation( program, "vTexCoord"), 2, gl.FLOAT, false, false, 0, 0 ),
                                new Shader_Attribute( gl.getAttribLocation( program, "vColor"), 3, gl.FLOAT, false, false, 0, 0 )	];

    for( var i = 0; i < shader_variable_names.length; i++ )
      this[ shader_variable_names[i] + "_loc" ] = gl.getUniformLocation( program, shader_variable_names[i] );
  } 

function Shader( vertexShaderID, fragmentShaderID )         // Create one of these objects to load a new shader program (made up of a vertex shader and fragment shader) onto the graphics card.
  {
    var vertShdr, fragShdr, vertElem = document.getElementById( vertexShaderID );
    if ( !vertElem ) { alert( "Unable to load vertex shader " + vertexShaderID ); return -1;  }

    vertShdr = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource( vertShdr, vertElem.text );
    gl.compileShader( vertShdr );
    if ( !gl.getShaderParameter(vertShdr, gl.COMPILE_STATUS) )
      {  alert( "Vertex shader failed to compile.  The error log is:" + "<pre>" + gl.getShaderInfoLog( vertShdr ) + "</pre>" );  return -1;  }
    
    var fragElem = document.getElementById( fragmentShaderID );
    if ( !fragElem ) {  alert( "Unable to load vertex shader " + fragmentShaderID );  return -1;  }

    fragShdr = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource( fragShdr, fragElem.text );
    gl.compileShader( fragShdr );
    if ( !gl.getShaderParameter(fragShdr, gl.COMPILE_STATUS) )
      {  alert( "Fragment shader failed to compile.  The error log is:" + "<pre>" + gl.getShaderInfoLog( fragShdr ) + "</pre>" );  return -1;  }

    var program = gl.createProgram();
    gl.attachShader( program, vertShdr );
    gl.attachShader( program, fragShdr );
    gl.linkProgram( program );
    if ( !gl.getProgramParameter(program, gl.LINK_STATUS) )
      {  alert( "Shader program failed to link.  The error log is:" + "<pre>" + gl.getProgramInfoLog( program ) + "</pre>" );  return -1;  }

    this.program = program;
  }

  Shader.prototype.activate = function() {     gl.useProgram( this.program );     g_addrs = new Graphics_Addresses( this.program );   }
  
function GL_Context( canvas_id, background_color )
	{																// Special WebGL initialization
		canvas = document.getElementById( canvas_id ),   	  canvas_size = [ canvas.width, canvas.height ];
		if (!window.WebGLRenderingContext) { alert( "http://get.webgl.org to get a compatible browser " );	}
		var names = ["webgl", "experimental-webgl", "webkit-3d", "moz-webgl"];
		for (var ii = 0; ii < names.length; ++ii)
			if ( gl = canvas.getContext(names[ii]) )
        break;
		if ( !gl && canvas.parentNode ) canvas.parentNode.innerHTML = "Computer won't run WebGL - http://get.webgl.org/troubleshooting/ for help";
		gl.getExtension("OES_element_index_uint");
		
		gl.clearColor.apply( gl, background_color ); 	    // Tell the graphics card which background color to clear the canvas with each time we display()		  
		gl.viewport( 0, 0, canvas.width, canvas.height );
		gl.enable(gl.DEPTH_TEST);
		gl.enable( gl.BLEND );
		gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
			
		this.displayables = [];
		this.debug_screen = new Debug_Screen();
		this.register_display_object( this.debug_screen );
	}

	GL_Context.prototype.register_display_object = function( object ) { this.displayables.unshift( object );  object.init_keys(); }
	GL_Context.prototype.render = function( time )
	{ 	
		gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		for( var i = 0; i < this.displayables.length; i++ )
		{
			this.displayables[ i ].display( time );
			this.displayables[ i ].update_strings( this.debug_screen );
		}
		window.requestAnimFrame( this.render.bind( this ) );			// Now that this frame is drawn, request that it happen again as soon as all other OpenGL events are processed.
	};

// *******************************************************
// Debug_Screen - An example of a displayable object that our class GL_Context can manage.  Displays the text of the user interface.
function Debug_Screen()	
{	this.string_map = { };	this.m_text = new Text_Line( 20 ); 		this.start_index = 0;	this.tick = 0; 	this.visible = false;
	this.graphicsState = new GraphicsState( mat4(), mat4(), 0 );
}

Debug_Screen.prototype.display = function(time)
{
	if( !this.visible ) return;

	shaders["Default"].activate();
	gl.uniform4fv( g_addrs.shapeColor_loc, 	Color( .8,.8,.8,1 ) );
	
	var model_transform = rotation( -90, vec3( 0, 1, 0 ) );                           
	    model_transform = mult( model_transform, translation( .1, -.9, .9 ) );
	    model_transform = mult( model_transform, scale( 1, .075, .05) );
	
	var strings = Object.keys( this.string_map );
	
	for( var i = 0, idx = this.start_index; i < 4 && i < strings.length; i++, idx = (idx + 1) % strings.length )
	{
		this.m_text.set_string( this.string_map[ strings[idx] ] );
		this.m_text.draw( this.graphicsState, model_transform, true, vec4(0,0,0,1) );		// Comment this out to not display any strings on the UI			
		model_transform = mult( model_transform, translation( 0, 1, 0 ) );
	}
	
	model_transform     = mult( model_transform, translation( 0, 20, -32 ) );
	this.m_text.set_string( "Controls:" );
	this.m_text.draw( this.graphicsState, model_transform, true, vec4(0,0,0,1) );		// Comment this out to not display any strings on the UI
	
	var key_combinations = Object.keys( shortcut.all_shortcuts );
	for( var i = 0; i < key_combinations.length; i++ )
	{
		model_transform = mult( model_transform, translation( 0, -1, 0 ) );				
		this.m_text.set_string( key_combinations[i] );
		this.m_text.draw( this.graphicsState, model_transform, true, vec4(0,0,0,1) );		// Comment this out to not display any controls on the UI
	}
}

Debug_Screen.prototype.init_keys = function() 
{		
	shortcut.add( "2",     ( function(self) { return function() { self.start_index = ( self.start_index + 1) % Object.keys( self.string_map ).length; };  } ) (this) );	
	shortcut.add( "1",     ( function(self) { return function() { self.start_index = ( self.start_index - 1  + Object.keys( self.string_map ).length ) % Object.keys( self.string_map ).length; };  } ) (this) );	
	shortcut.add( "v",     ( function(self) { return function() { self.visible = !self.visible; };  } ) (this) );	
};

Debug_Screen.prototype.update_strings = function( debug_screen_object ) 		// Strings that this displayable object (Debug_Screen) contributes to the UI:
{
	debug_screen_object.string_map["tick"] = "Frame: " + this.tick++;
	debug_screen_object.string_map["text_scroll_index"] = "Text scroll index: " + this.start_index;
	
}
  
window.requestAnimFrame = (function() {						// When called, queue up this browser's version of requestAnimationFrame()
  return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
    function( callback, element) { window.setTimeout(callback, 1000/60);  };
})();