// *******************************************************
// The UCLA Shapes library - An attempt to generate the largest diversity of primitive 3D shapes using the smallest amount of code.   
// CS 174a Graphics Example Code (Javascript and C++ translations available)

// *******************************************************
// CS 174a Graphics Example Code
// Shape.js - Each shape manages lists of its own vertex positions, vertex normals, and texture coordinates per vertex.  
// Instantiating a shape automatically calls OpenGL functions to pass each list into a buffer in the graphics card's memory.

// A few utility functions come next and then we will describe the Shape class:

var textures = {};
function initTexture(filename, bool_mipMap) 
	{
		textures[filename] = {} ;
		textures[filename].id 				= gl.createTexture();
		textures[filename].image 			= new Image();    
		textures[filename].image.onload 	= (	function (texture, bool_mipMap) {
			return function( ) {			
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
				gl.bindTexture(gl.TEXTURE_2D, texture.id);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				if(bool_mipMap)
					{	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);	gl.generateMipmap(gl.TEXTURE_2D);	}
				else
						gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				texture.loaded = true;
			}
		}	) (textures[filename], bool_mipMap);
		textures[filename].image.src 		= filename;
	}

function inherit(subType, superType)                            // Inheriting from a class in javascript.
	{
		var p = Object.create(superType.prototype);
		p.constructor = subType;
		subType.prototype = p;
	}
  
function Make_Shape_Subclass( name, superclass )                // More specific inheritance code for Shapes.
  {
    window[name] = function( args )                             // Repeat for all Shapes:
    {
      superclass.call( this );                                  // Inherit the vertex array members of "Shape", the parent class, by calling the parent constructor.
      this.populate.apply( this, [ this, ...arguments ] );      // A new Shape immediately populates its own arrays with appropriate vertices for its sub-type (polymorphism).
      this.init_buffers();                                      // then sends the arrays to the graphics card into new buffers.
    }
    inherit(window[name], superclass);                          // Override the superclass's "prototype" so that member functions work right.
  }
  
function mult_vec(M, v)
{
	v_4 = v.length == 4 ? v : vec4( v, 0 );
	v_new = vec4();
	v_new[0] = dot( M[0], v_4 );
	v_new[1] = dot( M[1], v_4 );
	v_new[2] = dot( M[2], v_4 );
	v_new[3] = dot( M[3], v_4 );
	return v_new;
}

function toMat3( mat4_affine )
	{
		var m = [];
		m.push( mat4_affine[0].slice( 0, 3 ) );
		m.push( mat4_affine[1].slice( 0, 3 ) );
		m.push( mat4_affine[2].slice( 0, 3 ) );
		m.matrix = true;
		return m;
	}
	
function Material( color, ambient, diffusivity, shininess, smoothness, texture_filename )
	{
		this.color = color;	this.ambient = ambient;  this.diffusivity = diffusivity; this.shininess = shininess; 
		this.smoothness = smoothness; this.texture_filename = texture_filename;
		// this.id = Color(1, 1, 1, 1);
	}

// Material.prototype.setID = function(id_color) {
// 	this.id = id_color;
// };
	
  
  
// *******************************************************
// IMPORTANT: When you extend the Shape class, these are the four arrays you must put values into.  Each shape has a list of vertex positions (here just called vertices), vertex normals 
// (vectors that point away from the surface for each vertex), texture coordinates (pixel coordintates in the texture picture, scaled down to the range [ 0.0, 1.0 ] to place each vertex 
// somewhere relative to the picture), and most importantly - indices, a list of index triples defining which three vertices belong to each triangle.  Your class must build these lists 
// and then send them to the graphics card by calling init_buffers().
function Shape()
	{
		this.positions = [];
		this.normals = [];
		this.texture_coords = [];
		this.indices = [];
		this.indexed = true;
	}
  
// Automatically assign the correct normals to each triangular element to achieve flat shading.  Affect all recently added triangles (those past "offset" in the list).  Pass true
// normally; for an indexed shape pass false to prepare it flat shading if it is not ready -- that is, if there are any edges where the same vertices are indexed by 
// both the adjacent triangles, and those two triangles are not co-planar.  The two would therefore fight over assigning different normal vectors to the shared vertices.
  Shape.prototype.flat_shade = function( offset, index_offset, is_ready )
		{     
      if( !is_ready )
      {
        var temp_positions = this.positions.slice( 0, offset ), temp_tex_coords = this.texture_coords.slice( 0, offset ), temp_normals = this.normals.slice( 0, offset );
        var temp_indices   = this.indices.slice( 0, index_offset );
        
        for( var counter = index_offset; counter < this.indices.length; counter++ )
          {   temp_positions.push( this.positions[ this.indices[ counter ] ] );   temp_tex_coords.push( this.texture_coords[ this.indices[ counter ] ] );
              temp_indices.push( temp_positions.length - 1 );    }
        this.positions =  temp_positions;       this.indices = temp_indices;    this.texture_coords = temp_tex_coords;
      }
      
			for( var counter = index_offset; counter < this.indices.length; counter += 3 )         // Iterate through triangles (every triple in the "indices" array)
			{   
        var indices = this.indexed ? [ this.indices[ counter ], this.indices[ counter + 1 ], this.indices[ counter + 2 ] ] : [ counter, counter + 1, counter + 2 ];     
        var p1 = this.positions[ indices[0] ],     p2 = this.positions[ indices[1] ],         p3 = this.positions[ indices[2] ];       
				var n1 = normalize( cross( subtract(p1, p2), subtract(p3, p1)) );		// Cross two edge vectors of this triangle together to get the normal
        
         if( length( add( scale_vec( .1, n1 ), p1 ) ) < length( p1 ) )
           n1 = scale_vec( -1, n1 );										// Flip the normal if adding it to the triangle brings it closer to the origin.
          
        this.normals[ indices[0] ] = this.normals[ indices[1] ] = this.normals[ indices[2] ] = vec3( n1[0], n1[1], n1[2] );   // Propagate the normal to the 3 vertices.
			}
		};
    
	Shape.prototype.spherical_texture_coords = function( vert_index )
		{	this.texture_coords.push( vec2( .5 + Math.atan2( this.positions[vert_index][2], this.positions[vert_index][0] ) / 2 / Math.PI, .5 - 2 * Math.asin( this.positions[vert_index][1] ) / 2 / Math.PI ) ); }
	
  // Generate one part of a curve.  Returns an array of two points:  A line segment of a curve.  Repeatedly call this and increase the "segment" number to get the full
  // curve.  To specify the curve's location, supply endpoints a and b and tangents da and db.  Adjust num_segments to increase / decrease granularity.
  Shape.prototype.curveSegment = function( a, b, da, db, segment, num_segments )  
  {
    var t = segment / num_segments, t_next = (segment+1) / num_segments,    
    curveMatrix = [ b, a, db, da ];
    curveMatrix.matrix = true;
    var hermiteMatrix = mat4( -2, 3, 0, 0 ,   2, -3, 0, 1,   1, -1, 0, 0,   1, -2, 1, 0 ),   
    point1 = mult_vec( mult( transpose( curveMatrix ), hermiteMatrix ), vec4( t*t*t, t*t, t, 1 ) ), //Applying the hermite polynomial at time t to generate a point
    point2 = mult_vec( mult( transpose( curveMatrix ), hermiteMatrix ), vec4( t_next*t_next*t_next, t_next*t_next, t_next, 1 ) ); //Applying the hermite polynomial at time t_next to generate a point
    return [ point1, point2 ];
  }
  
	Shape.prototype.init_buffers = function()			// Send the completed vertex and index lists to their own buffers in the graphics card.
		{
			this.graphics_card_buffers = [];	// Memory addresses of the buffers given to this shape in the graphics card.
			for( var i = 0; i < 4; i++ )
			{
				this.graphics_card_buffers.push( gl.createBuffer() );
				gl.bindBuffer(gl.ARRAY_BUFFER, this.graphics_card_buffers[i] );
				switch(i) {
					case 0: gl.bufferData(gl.ARRAY_BUFFER, flatten(this.positions), gl.STATIC_DRAW); break;
					case 1: gl.bufferData(gl.ARRAY_BUFFER, flatten(this.normals), gl.STATIC_DRAW); break;
					case 2: gl.bufferData(gl.ARRAY_BUFFER, flatten(this.texture_coords), gl.STATIC_DRAW); break;	}
			}
			
			if( this.indexed )
			{
				this.index_buffer = gl.createBuffer();
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.index_buffer);
				gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.indices), gl.STATIC_DRAW);
			}
		};
	
	
	Shape.prototype.update_uniforms = function( graphicsState, model_transform, material )			// Send the current matrices to the shader
		{
				var camera_model_transform 				= mult( graphicsState.camera_transform, model_transform );
				var projection_camera_model_transform 	= mult( graphicsState.projection_transform, camera_model_transform );
				var camera_model_transform_normal		= toMat3( transpose( inverse( camera_model_transform ) ) );
				
				gl.uniformMatrix4fv( g_addrs.camera_transform_loc, 					        false, flatten( graphicsState.camera_transform ) );
				gl.uniformMatrix4fv( g_addrs.camera_model_transform_loc, 			      false, flatten( camera_model_transform ) );
				gl.uniformMatrix4fv( g_addrs.projection_camera_model_transform_loc, false, flatten( projection_camera_model_transform ) );
				gl.uniformMatrix3fv( g_addrs.camera_model_transform_normal_loc, 	  false, flatten( camera_model_transform_normal ) );
				   
				gl.uniform4fv( g_addrs.shapeColor_loc, 	 material.color );		// Send a desired shape-wide color to the graphics card
				gl.uniform1f ( g_addrs.ambient_loc,      material.ambient );
				gl.uniform1f ( g_addrs.diffusivity_loc,  material.diffusivity );
				gl.uniform1f ( g_addrs.shininess_loc,    material.shininess );
				gl.uniform1f ( g_addrs.smoothness_loc,   material.smoothness );
				gl.uniform1f ( g_addrs.animation_time_loc, graphicsState.animation_time / 1000 );

				gl.uniform4fv( g_addrs.object_id_loc, Color(1, 1, 1, 1));
        
        if( !graphicsState.lights.length )  return;
        var lightPositions_flattened = [], lightColors_flattened = []; lightAttenuations_flattened = [];
				for( var i = 0; i < 4 * graphicsState.lights.length; i++ )
				{
					   lightPositions_flattened                  .push( graphicsState.lights[ Math.floor(i/4) ].position[i%4] );
					   lightColors_flattened                     .push( graphicsState.lights[ Math.floor(i/4) ].color[i%4] );
             lightAttenuations_flattened[ Math.floor(i/4) ] = graphicsState.lights[ Math.floor(i/4) ].attenuation;
				}
				gl.uniform4fv( g_addrs.lightPosition_loc,       lightPositions_flattened );
				gl.uniform4fv( g_addrs.lightColor_loc,          lightColors_flattened );   
				gl.uniform1fv( g_addrs.attenuation_factor_loc,  lightAttenuations_flattened );
		};
		
	// The same draw() call is used for every shape - for each, these calls produce different results due to the different vertex lists we stored in the graphics card for them.
	Shape.prototype.draw = function( graphicsState, model_transform, material )
		{
			this.update_uniforms( graphicsState, model_transform, material );
			
			if( material.texture_filename && textures[ material.texture_filename ].loaded )			// Omit the texture string parameter to signal that we don't want to texture this shape.
			{
				g_addrs.shader_attributes[2].enabled = true;
				gl.uniform1f ( g_addrs.USE_TEXTURE_loc, 1 );
				gl.bindTexture(gl.TEXTURE_2D, textures[ material.texture_filename ].id);
			}
			else
				{	gl.uniform1f ( g_addrs.USE_TEXTURE_loc, 0 );		g_addrs.shader_attributes[2].enabled = false;	}
			
			for( var i = 0, it = g_addrs.shader_attributes[0]; i < g_addrs.shader_attributes.length, it = g_addrs.shader_attributes[i]; i++ )
				if( it.enabled )
				{
					gl.enableVertexAttribArray( it.index );
					gl.bindBuffer( gl.ARRAY_BUFFER, this.graphics_card_buffers[i] );
					gl.vertexAttribPointer( it.index, it.size, it.type, it.normalized, it.stride, it.pointer );
				}
				else
					gl.disableVertexAttribArray( it.index );
			
			if( this.indexed )			
			{
				gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, this.index_buffer );
				gl.drawElements( gl.TRIANGLES, this.indices.length, gl.UNSIGNED_INT, 0 );
			}
			else
				gl.drawArrays  ( gl.TRIANGLES, 0, this.vertices.length );
		};


		Shape.prototype.update_uniforms_w_id = function( graphicsState, model_transform, material, id )			// Send the current matrices to the shader
		{
				var camera_model_transform 				= mult( graphicsState.camera_transform, model_transform );
				var projection_camera_model_transform 	= mult( graphicsState.projection_transform, camera_model_transform );
				var camera_model_transform_normal		= toMat3( transpose( inverse( camera_model_transform ) ) );
				
				gl.uniformMatrix4fv( g_addrs.camera_transform_loc, 					        false, flatten( graphicsState.camera_transform ) );
				gl.uniformMatrix4fv( g_addrs.camera_model_transform_loc, 			      false, flatten( camera_model_transform ) );
				gl.uniformMatrix4fv( g_addrs.projection_camera_model_transform_loc, false, flatten( projection_camera_model_transform ) );
				gl.uniformMatrix3fv( g_addrs.camera_model_transform_normal_loc, 	  false, flatten( camera_model_transform_normal ) );
				   
				gl.uniform4fv( g_addrs.shapeColor_loc, 	 material.color );		// Send a desired shape-wide color to the graphics card
				gl.uniform1f ( g_addrs.ambient_loc,      material.ambient );
				gl.uniform1f ( g_addrs.diffusivity_loc,  material.diffusivity );
				gl.uniform1f ( g_addrs.shininess_loc,    material.shininess );
				gl.uniform1f ( g_addrs.smoothness_loc,   material.smoothness );
				gl.uniform1f ( g_addrs.animation_time_loc, graphicsState.animation_time / 1000 );

				gl.uniform4fv( g_addrs.object_id_loc, id);
        
        if( !graphicsState.lights.length )  return;
        var lightPositions_flattened = [], lightColors_flattened = []; lightAttenuations_flattened = [];
				for( var i = 0; i < 4 * graphicsState.lights.length; i++ )
				{
					   lightPositions_flattened                  .push( graphicsState.lights[ Math.floor(i/4) ].position[i%4] );
					   lightColors_flattened                     .push( graphicsState.lights[ Math.floor(i/4) ].color[i%4] );
             lightAttenuations_flattened[ Math.floor(i/4) ] = graphicsState.lights[ Math.floor(i/4) ].attenuation;
				}
				gl.uniform4fv( g_addrs.lightPosition_loc,       lightPositions_flattened );
				gl.uniform4fv( g_addrs.lightColor_loc,          lightColors_flattened );   
				gl.uniform1fv( g_addrs.attenuation_factor_loc,  lightAttenuations_flattened );
		};
		
	// The same draw() call is used for every shape - for each, these calls produce different results due to the different vertex lists we stored in the graphics card for them.
	Shape.prototype.draw_w_id = function( graphicsState, model_transform, material, id )
		{
			this.update_uniforms_w_id( graphicsState, model_transform, material, id );
			
			if( material.texture_filename && textures[ material.texture_filename ].loaded )			// Omit the texture string parameter to signal that we don't want to texture this shape.
			{
				g_addrs.shader_attributes[2].enabled = true;
				gl.uniform1f ( g_addrs.USE_TEXTURE_loc, 1 );
				gl.bindTexture(gl.TEXTURE_2D, textures[ material.texture_filename ].id);
			}
			else
				{	gl.uniform1f ( g_addrs.USE_TEXTURE_loc, 0 );		g_addrs.shader_attributes[2].enabled = false;	}
			
			for( var i = 0, it = g_addrs.shader_attributes[0]; i < g_addrs.shader_attributes.length, it = g_addrs.shader_attributes[i]; i++ )
				if( it.enabled )
				{
					gl.enableVertexAttribArray( it.index );
					gl.bindBuffer( gl.ARRAY_BUFFER, this.graphics_card_buffers[i] );
					gl.vertexAttribPointer( it.index, it.size, it.type, it.normalized, it.stride, it.pointer );
				}
				else
					gl.disableVertexAttribArray( it.index );
			
			if( this.indexed )			
			{
				gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, this.index_buffer );
				gl.drawElements( gl.TRIANGLES, this.indices.length, gl.UNSIGNED_INT, 0 );
			}
			else
				gl.drawArrays  ( gl.TRIANGLES, 0, this.vertices.length );
		};