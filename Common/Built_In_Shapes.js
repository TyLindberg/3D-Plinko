// *******************************************************
// The UCLA Shapes library - An attempt to generate the largest diversity of primitive 3D shapes using the smallest amount of code.     
// CS 174a Graphics Example Code (Javascript or C++ versions)

// Built_In_Shapes.js - Defines a number of objects that inherit from class Shape.  All Shapes have certain arrays.  Each array manages either the shape's 3D vertex 
// positions, vertex normal vectors, 2D texture coordinates, and any other per-vertex quantity.  All subclasses of Shape inherit all these arrays.  
// Upon instantiation, any Shape subclass populates these lists in their own way, and then automatically makes GL calls -- special kernel
// functions to copy each of the lists one-to-one into new buffers in the graphics card's memory.


// *********** PART 1: HELPER SHAPES USEFUL FOR BUILDING OTHER, LARGER SHAPES ***********
//
//  - Patch
//  - Tube
//  - Cone tip
//  - Torus
//  - Sphere
//  - Regular polygon

// These Shapes are coded with the functionality to fill up either their own arrays, or those of another Shape object, with the triangles they generate.  
// In the former case, these Shapes can stand alone and will make simple primitives.  In the latter case "compound shapes" can be built that seamlessly 
// piece together multiple helper Shapes into one large point cloud and triangle list.  These "compound shapes" are defined later in this file.  

// When trying to build large vertex arrays in the graphics card, combining existing arrays this way can be more convenient than having to manage a huge list of vertices
//  and manually specify the points of each sub-component. Large vertex arrays can, furthermore, be desirable -- due to the low performance cost of their re-use
// with a single draw call, compared to drawing them out of pieces.

// Helper Shapes come with some extra code:  A "points_transform" argument that applies a matrix to all the points we insert, re-locating them in the space 
// of the larger object we're buliding.  Also, their "populate" function is static and takes a "recipient", allowing them to populate either their own 
// arrays or another Shape's.  Each call to populate() now needs to start by storing offsets for the place in the lists where the existing points stop and 
// the new ones we add during this call start, so that we only don't apply points_transform to existing data.


// *********** PART 2: COMPOUND SHAPES, BUILT FROM THE ABOVE HELPER SHAPES ***********
//
//  - Cone
//  - Prism
//  - Cube
//  - Axis arrows
//  - Line of text
//  - Cylinder (a tube with circular fans on the ends)

// These compound shapes depend on the Shapes from the above section to fill their arrays, instead of populating their own lists of points and triangles from scratch.

// ----------------------------------------------------------------------------------------------

// ----------------------------------------------------------------------------------------------

// *********** PART 1: HELPER SHAPES MAINLY FOR BUILDING OTHER, LARGER SHAPES ***********
    

// *********** PATCH ***********
// Produce a curved grid -- more accurately, a generalized cylinder section.  Do this by specifying a line segment, and generating a rectangular
// grid mesh spanning the area that is swept as that segment rotates around the origin.  To linearly extrude a curve instead, pass in zero for total curvature angle.

Make_Shape_Subclass( "Patch", Shape );
	Patch.prototype.populate = function( recipient, rows, columns, total_curvature_angle, points, flat_shade, points_transform = mat4() )	
  {	
    var offset = recipient.positions.length,      index_offset = recipient.indices.length; 
    
    for( var i = 0; i <= rows; i++ )        // Travel down the curve spelled out by the parameter "points"
    {
      var frac = i / rows * ( points.length - 1 ), alpha = frac - Math.floor( frac ),   // Which points in that array are we between?
          currPoint = vec4( add( scale_vec( 1 - alpha, points[ Math.floor( frac ) ] ), scale_vec( alpha, points[ Math.ceil( frac ) ] ) ), 1 ),
          tangent   = frac-1 < 0     ? subtract( points[ 1 ], points[ 0 ] ) : subtract( points[ Math.ceil( frac ) ], points[ Math.ceil( frac - 1 ) ] );
          normal    = vec4( cross( tangent, vec3( 0, 1, 0 ), 1 ) ); 
          normal    = normalize( normal );
      
      for( var j = 0; j <= columns; j++ )
      {
        var spin = ( total_curvature_angle == 0 ) ? translation( 0, j, 0 ) : rotation( j * total_curvature_angle/columns, 0, 0, 1 );
        recipient.positions.push( vec3( mult_vec( spin, currPoint ) ) );            if( !flat_shade ) recipient.normals.push( vec3( mult_vec( spin, normal ) ) );
        recipient.texture_coords.push( vec2( j, 1 - i ) );
      }
    }
    for( var h = 0; h < rows; h++ )
      for( var i = 0; i < 2 * columns; i++ )
        for( var j = 0; j < 3; j++ )
          recipient.indices.push( h * ( columns + 1 ) + columns * ( ( i + ( j % 2 ) ) % 2 ) + ( Math.floor( ( j % 3 ) / 2 ) ? 
                                            ( Math.floor( i / 2 ) + 2 * ( i % 2 ) )       :       ( Math.floor( i / 2 ) + 1 ) ) );                           
                              
    for( var i = index_offset; i < recipient.indices.length; i++ ) recipient.indices[i] += offset;    // In case recipient had things in it already
    for( var i = offset; i < recipient.positions.length; i++ )                         // Apply points_transform to all points added during this call
      { recipient.positions[i] = vec3( mult_vec( points_transform, vec4( recipient.positions[ i ], 1 ) ) );    
        recipient.normals[i]  = vec3( mult_vec( transpose( inverse( points_transform ) ), vec4( recipient.normals[ i ], 1 ) ) );     }
                    
    // if( flat_shade ) recipient.flat_shade( offset, index_offset, false );
  }
    
    

// *********** CYLINDRICAL TUBE ***********   An open tube shape with equally sized sections, pointing down Z locally.    

Make_Shape_Subclass( "Cylindrical_Tube", Shape );
	Cylindrical_Tube.prototype.populate = function( recipient, rows, columns, points_transform = mat4() )	
				{	 Patch.prototype.populate( recipient, rows, columns, 360, [ vec3( 1, 0, .5 ), vec3( 1, 0, -.5 ) ], false, points_transform );     }

// *********** CONE TIP ***********

Make_Shape_Subclass( "Tip", Shape );
	Tip.prototype.populate = function( recipient, rows, columns, points_transform )	
				{	 Patch.prototype.populate( recipient, rows, columns, 360, [ vec3( 0, 0,  1 ), vec3( 1, 0, -1 ) ], false, points_transform );     }
        
        

// *********** SPHERE ***********   ( With lattitude / longitude divisions; this creates singularities in the mesh at the top and bottom.  An alternative is at the bottom of this file. )

Make_Shape_Subclass( "Sphere", Shape );
	Sphere.prototype.populate = function( recipient, rows, columns, points_transform = mat4() )	
    {	 
      var circle_points = [];
      for( var i = 0; i <= rows; i++ )   circle_points.push( vec3( Math.cos( i/rows * Math.PI - Math.PI/2 ), 0, Math.sin( i/rows * Math.PI - Math.PI/2 ) ) );
      
      Patch.prototype.populate( recipient, rows, columns, 360, circle_points, true, points_transform );   

      for(var i = 0; i < recipient.positions.length; i++) {
        recipient.normals[i] = normalize(recipient.positions[i]);
      }  
    }        
        
        
// *********** TORUS ***********

Make_Shape_Subclass( "Torus", Shape );
	Torus.prototype.populate = function( recipient, rows, columns, points_transform = mat4() )	
    {	 
      var circle_points = [];
      for( var i = 0; i <= rows; i++ )   circle_points.push( vec3( 1.5 + Math.cos( i/rows * 2*Math.PI ), 0, Math.sin( i/rows * 2*Math.PI ) ) );
      
      Patch.prototype.populate( recipient, rows, columns, 360, circle_points, true, points_transform );     
    }

// *********** TRIANGLE FAN ***********
// With each call to add_fan_point, point 0 is connected to the two newest points to generate a new triangle.  All triangles thereby fan out from point 0.

function Triangle_Fan()		{	Shape.call(this);	};
inherit( Triangle_Fan, Shape );

	Triangle_Fan.prototype.add_fan_point = function( recipient, center_idx, position, normal, texture_coord )   // Convert from a more compact ordering 
		{			              
      recipient.positions.push( position );     recipient.texture_coords.push( texture_coord );    recipient.normals.push( normal );
      if( recipient.positions.length - center_idx > 2 )      recipient.indices.push( recipient.positions.length - 1, center_idx, recipient.positions.length - 2 );
		};

// *********** UNIFORM N-SIDED POLYGON ***********
// Unlike Patch(), creates a regular polygon using the minimal number of triangles

Make_Shape_Subclass( "N_Polygon", Triangle_Fan );
	N_Polygon.prototype.populate = function( recipient, n, points_transform = mat4() )	
    {	 
      var offset = recipient.positions.length;
      for( var i = 0; i < n; i++ )     this.add_fan_point( recipient, offset, vec3( Math.cos( i/n * 2*Math.PI ), Math.sin( i/n * 2*Math.PI ), 0 ), vec3(0, 0, 1), vec2( .5 + .5 * Math.cos( i/n * 2*Math.PI ), .5 + .5 * Math.sin( i/n * 2*Math.PI ) ) ); 
         
      for( var i = offset; i < recipient.positions.length; i++ )                         // Apply points_transform to all points added during this call
        { recipient.positions[i] = vec3( mult_vec( points_transform, vec4( recipient.positions[ i ], 1 ) ) );    
          recipient.normals[i]  = vec3( mult_vec( transpose( inverse( points_transform ) ), vec4( recipient.normals[ i ], 1 ) ) );     } 
    }

        
    
// ----------------------------------------------------------------------------------------------
// *********** PART 2: COMPOUND SHAPES, BUILT FROM THE ABOVE HELPER SHAPES ***********


// *********** CLOSED CONE ***********

Make_Shape_Subclass( "Cone", Shape );
	Cone.prototype.populate = function( recipient, rows, columns, points_transform = mat4() )	
    {	Tip.prototype.populate( recipient, rows, columns, points_transform );    
      points_transform = mult( points_transform, rotation( 180, 0, 1, 0 ) );
      N_Polygon.prototype.populate( recipient, columns, mult( points_transform, translation( 0, 0, 1 ) ) );      }

// *********** Rounded alternative to the above ***********

Make_Shape_Subclass( "Rounded_Cone", Shape );
	Rounded_Cone.prototype.populate = function( recipient, rows, columns, points_transform = mat4() )	
    { Patch.prototype.populate( recipient, rows, columns, 360, [ vec3( 0, 0, 1 ), vec3( 1, 0, -1 ), vec3( 0, 0, -1 )  ], false, points_transform ); }

           
// *********** CYLINDER (WITH CAPS) ***********
// Combine a tube and two flattened triangle fans to make a solid cylinder.
    
Make_Shape_Subclass( "Capped_Cylinder", Shape );
  Capped_Cylinder.prototype.populate = function ( recipient, rows, columns, points_transform = mat4() )
    { Cylindrical_Tube.prototype.populate( recipient, rows, columns, points_transform );
      N_Polygon.prototype.populate( recipient, columns, mult( points_transform, translation( 0, 0, .5 ) ) ); 
      points_transform = mult( points_transform, rotation( 180, 0, 1, 0 ) );
      N_Polygon.prototype.populate( recipient, columns, mult( points_transform, translation( 0, 0, .5 ) ) ); }
      
// *********** Rounded alternative to the above ***********

Make_Shape_Subclass( "Rounded_Capped_Cylinder", Shape );                                
  Rounded_Capped_Cylinder.prototype.populate = function ( recipient, rows, columns, points_transform = mat4() )
    {   Patch.prototype.populate( recipient, rows, columns, 360, [ vec3( 0, 0, .5 ), vec3( 1, 0, .5 ), vec3( 1, 0, -.5 ), vec3( 0, 0, -.5 ) ], false, points_transform );  }
   
// *********** PRISM ***********
// A regular polygon extruded along a perpendicular line, into a prism.

Make_Shape_Subclass( "Prism", Shape );
  Prism.prototype.populate = function ( recipient, rows, columns, points_transform = mat4() )
  {
    var offset = this.positions.length;    var index_offset = this.indices.length;	
    Capped_Cylinder.prototype.populate( this, rows, columns, points_transform )
      
    this.flat_shade( offset, index_offset, false );
  }
     

// *********** CUBE ***********
Make_Shape_Subclass( "Cube", Shape );
	Cube.prototype.populate = function( recipient, points_transform = mat4() )	
    {
      for( var i = 0; i < 3; i++ )										// Build a cube by inserting six square strips into the lists.
				for( var j = 0; j < 2; j++ )
        {
          var square_transform = mult( rotation(180 * j, vec3(0, 0, 1)), translation(-.5, 0, 0) );	// Right if j
              square_transform = mult( rotation(90, vec3(i == 0, -(i == 1), i == 2)), square_transform ); // rotate to match face
          
          Old_Square.prototype.populate( recipient, mult( points_transform, square_transform) );             
        }
    }


// *********** AXIS ARROWS ***********
// Made out of several primitives.  Comes with the ability to turn itself visible or invisible depending on if it's the "selected" instance of this shape or not.

function Axis()
	{
		Shape.call(this);
		
		this.basis_selection = 0;
		this.drawOneAxis = function( object_transform )
		{
			var original = object_transform;
			object_transform = mult( object_transform, translation(0, 0, 4));
			object_transform = mult( object_transform, scale(.25, .25, .25));
      Cone.prototype.populate ( this, 4, 10, object_transform );
			object_transform = original;
			object_transform = mult( object_transform, translation(.95, .95, .5));
			object_transform = mult( object_transform, scale(.1, .1, 1));
      Cube.prototype.populate( this, object_transform );
			object_transform = original;
			object_transform = mult( object_transform, translation(.95, 0, .5));
			object_transform = mult( object_transform, scale(.1, .1, 1));
      Cube.prototype.populate( this, object_transform );
			object_transform = original;
			object_transform = mult( object_transform, translation(0, .95, .5));
			object_transform = mult( object_transform, scale(.1, .1, 1));
      Cube.prototype.populate( this, object_transform );
			object_transform = original;			
			object_transform = mult( object_transform, translation(0, 0, 2));
			object_transform = mult( object_transform, scale(.1, .1, 4));
			Cylindrical_Tube.prototype.populate( this, 7, 7, object_transform );
		}
		
		this.populate = ( function (self) 
			{	
				var stack = [];				
				var object_transform = scale(.25, .25, .25);
				Subdivision_Sphere.prototype.populate( self, 3, false, object_transform );
				self.drawOneAxis( mat4() );
				object_transform = rotation(-90, vec3(1,0,0));
				object_transform = mult( object_transform, scale(1, -1, 1));
				self.drawOneAxis(object_transform);
				object_transform = rotation(90, vec3(0,1,0));
				object_transform = mult( object_transform, scale(-1, 1, 1));
				self.drawOneAxis(object_transform);				
			} )(this);
			
																													// Only draw this set of axes if it is the one selected through the user interface.
		this.draw = function( current, graphicsState, model_transform, material ) 	{ 	
			if( this.basis_selection == current ) Shape.prototype.draw.call(this, graphicsState, model_transform, material );	}	
			
		this.init_buffers();
	}
inherit( Axis, Shape );
				
      
// *********** OLD SQUARE ***********
// N-Polygon is the ideal Shape for making squares, but a prior method for producing squares creates very specific coordinates that other functions still rely on.

Make_Shape_Subclass( "Old_Square", Shape );
  Old_Square.prototype.populate = function( recipient, points_transform = mat4() )
    {
       var offset = recipient.positions.length;		var index_offset = recipient.indices.length;
       recipient.positions     .push( vec3(0,.5,-.5), vec3(0,.5,.5), vec3(0,-.5,-.5), vec3(0,-.5,.5) ); // Specify the 4 vertices -- the point cloud that our Square needs.
       recipient.normals       .push( vec3(-1,0,0), vec3(-1,0,0), vec3(-1,0,0), vec3(-1,0,0) ); // ...
       recipient.texture_coords.push( vec2(0,1),   vec2(1,1),   vec2(0,0),   vec2(1,0)   ); // ...
       recipient.indices       .push( 0, 1, 2,     1, 3, 2 );         // Two triangles this time, indexing into four distinct vertices.
       
       
      for( var i = index_offset; i < recipient.indices.length; i++ ) recipient.indices[i] += offset;    // In case recipient had things in it already
      for( var i = offset; i < recipient.positions.length; i++ )                         // Apply points_transform to all points added during this call
        { recipient.positions[i] = vec3( mult_vec( points_transform, vec4( recipient.positions[ i ], 1 ) ) );    
          recipient.normals[i]  = vec3( mult_vec( transpose( inverse( points_transform ) ), vec4( recipient.normals[ i ], 1 ) ) );     } 
    };

// *********** LINE OF TEXT ***********
// Draws a rectangle textured with images of ASCII characters over each quad, spelling out a string.  Each quad is a separate rectangle_strip.

function Text_Line( string_size )		
	{
		Shape.call(this);
		
		this.populate = ( function ( self, max_size ) 
			{	
				self.max_size = max_size;
				var object_transform = mat4();
				for( var i = 0; i < max_size; i++ )
				{
					Old_Square.prototype.populate( self, object_transform );
					object_transform = mult( object_transform, translation( 0, 0, -.7 ));
				}
			} )( this, string_size );
			
		this.init_buffers();
		
		this.draw = function( graphicsState, model_transform, heads_up_display, color ) 
			{
				if( heads_up_display )			{	gl.disable( gl.DEPTH_TEST );	}
				Shape.prototype.draw.call(this, graphicsState, model_transform, new Material( color, 1, 0, 0, 40, "text.png" ) );	
				if( heads_up_display )			{	gl.enable(  gl.DEPTH_TEST );	}
			}
			
		this.set_string = function( line )
			{
				for( var i = 0; i < this.max_size; i++ )
					{
						var row = Math.floor( ( i < line.length ? line.charCodeAt( i ) : ' '.charCodeAt() ) / 16 ),
							col = Math.floor( ( i < line.length ? line.charCodeAt( i ) : ' '.charCodeAt() ) % 16 );
							
						var skip = 3, size = 32, sizefloor = size - skip;
						var dim = size * 16, 	left  = (col * size + skip) / dim, 			top    = (row * size + skip) / dim, 
                                  right = (col * size + sizefloor) / dim, bottom = (row * size + sizefloor + 5) / dim;
						
						this.texture_coords[ 4 * i ]	   = vec2( right, 1 - top );
						this.texture_coords[ 4 * i + 1 ] = vec2( left,  1 - top );
						this.texture_coords[ 4 * i + 2 ] = vec2( right, 1 - bottom );
						this.texture_coords[ 4 * i + 3 ] = vec2( left,  1 - bottom );
					}

				gl.bindBuffer( gl.ARRAY_BUFFER, this.graphics_card_buffers[2] );
				gl.bufferData( gl.ARRAY_BUFFER, flatten(this.texture_coords), gl.STATIC_DRAW );
			}

	}
inherit( Text_Line, Shape );




// *********** PART 3: SUBDIVISION SURFACES (See Wikipedia) ***********

// *********** SUBDIVISION SPHERE ***********
// Demonstrates the use of subdivision surfaces:  Popular methods for retreiving arbitrarily complex point clouds from a formula.  This one generates 
// the point cloud of a sphere:  Begin with a tetrahedron.  For each face, connect the midpoints of each edge together to make more faces.  Repeat 
// recursively until the desired level of detail is obtained.  Project all new vertices to unit vectors (onto the unit sphere, so that they match our 
// desired formula) and group them into triangles by following the predictable pattern of the recursion.
//
// From the starting tetrahedron all the way down to the final sphere, we'll store each intermediate sphere on our way to the finest level=of-detail in 
// separate index lists.  That way when it's done we can also choose to draw spheres with coarser detail than max.

function Subdivision_Sphere( max_subdivisions, flat_shading, points_transform = mat4() )	
	{	
		Shape.call(this);	
		
		this.indices_LOD = [];
		this.index_buffer_LOD = [];
		for( var i = 1; i <= max_subdivisions; i++ )		// Empty index lists for each level-of-detail 
			this.indices_LOD[i] = [];
		
		this.populate( this, max_subdivisions, flat_shading, points_transform );
		
		for( var i = 1; i <= max_subdivisions; i++ )		// Each index list of every detail-level gets its own index buffer in the graphics card
		{
			this.index_buffer_LOD[i] = gl.createBuffer();
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.index_buffer_LOD[ i ] );
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array( this.indices_LOD[ i ] ), gl.STATIC_DRAW);
		}

    // console.log(this.indices.length);
		
		this.draw = function( graphicsState, model_transform, material, LOD ) 	   // When calling draw, choose a level of detail (LOD) out of the possibilities we've stored
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
				
			if( LOD === undefined || LOD < 0 || LOD + 1 >= this.indices_LOD.length )		// Activate the chosen level-of-detail index list and draw it
			{
				gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, this.index_buffer );
				gl.drawElements( gl.TRIANGLES, this.indices.length, gl.UNSIGNED_INT, 0 );
			}
			else
			{
				gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, this.index_buffer_LOD[ this.indices_LOD.length - 1 - LOD ] );
				gl.drawElements( gl.TRIANGLES, this.indices_LOD[ this.indices_LOD.length - 1 - LOD ].length, gl.UNSIGNED_INT, 0 );
			}			
		}
		this.init_buffers();
	}
inherit( Subdivision_Sphere, Shape );

	Subdivision_Sphere.prototype.populate = function ( recipient, max_subdivisions, flat_shading, points_transform = mat4() ) 
		{	
      var subdivideTriangle = function( a, b, c, recipient, count )		// This function will recurse through each level of detail by splitting triangle (a,b,c) into four smaller triangles.
      {	
        if( count <= 0)	// Base case of recursion - we've hit the finest level of detail we want.  Add the current subdivided triangle's index numbers to the master list of triangles.
        {		
          recipient.indices.push(a,b,c);		// Skipping every fourth vertex index in our list takes you down one level of detail, and so on, due to the way we're building it.			
          return;	
        }
        else if( recipient.indices_LOD && recipient.indices_LOD[count] )		// If we're not at the base case, our current triangle represents a lower (coarser) level of detail.
          recipient.indices_LOD[count].push(a,b,c);							// It goes into a list too, corresponding to that detail level.
        
        var ab_vert = normalize( mix( recipient.positions[a], recipient.positions[b], 0.5) );			// We're not at the base case.  So,
        var ac_vert = normalize( mix( recipient.positions[a], recipient.positions[c], 0.5) );			// build 3 new vertices at midpoints, and extrude them out to touch the unit sphere (length 1).
        var bc_vert = normalize( mix( recipient.positions[b], recipient.positions[c], 0.5) );	
              
        var ab = recipient.positions.length;		recipient.positions.push( ab_vert );			// The indices of the three new vertices
        var ac = recipient.positions.length;		recipient.positions.push( ac_vert );	
        var bc = recipient.positions.length;		recipient.positions.push( bc_vert );	

        subdivideTriangle( a, ab, ac,  recipient, count - 1 );			// Recurse on four smaller triangles, and we're done.
        subdivideTriangle( ab, b, bc,  recipient, count - 1 );
        subdivideTriangle( ac, bc, c,  recipient, count - 1 );
        subdivideTriangle( ab, bc, ac, recipient, count - 1 );
      }
    
			var offset = recipient.positions.length;    var index_offset = recipient.indices.length;	
			recipient.positions.push(		vec3(0.0, 0.0, -1.0) 				 );                              // Starting tetrahedron
			recipient.positions.push(		vec3(0.0, 0.942809, 0.333333) 		 );
			recipient.positions.push(		vec3(-0.816497, -0.471405, 0.333333) );
			recipient.positions.push(		vec3(0.816497, -0.471405, 0.333333)  );
			
			subdivideTriangle( 0 + offset, 1 + offset, 2 + offset, recipient, max_subdivisions);	// Begin recursion
			subdivideTriangle( 3 + offset, 2 + offset, 1 + offset, recipient, max_subdivisions);
			subdivideTriangle( 1 + offset, 0 + offset, 3 + offset, recipient, max_subdivisions);
			subdivideTriangle( 0 + offset, 2 + offset, 3 + offset, recipient, max_subdivisions); 
			
      
      for( var i = index_offset; i < recipient.indices.length; i++ ) recipient.indices[i] += offset;    // In case recipient had things in it already
      for( var i = offset; i < recipient.positions.length; i++ )          
        {
          recipient.spherical_texture_coords( i );
          recipient.normals[i] = recipient.positions[i].slice();		// On a sphere, we analytically know what the normals should be - the vector from the origin to the vertex.
          recipient.positions[i] = vec3( mult_vec( points_transform, vec4( recipient.positions[i], 1 ) ) );	      // Apply points_transform to all points added during this call.
        }
      if( flat_shading ) this.flat_shade( offset, index_offset, false );

      // console.log(this.indices.length);
		};
    
    