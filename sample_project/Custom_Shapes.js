// *******************************************************
// The UCLA Shapes library - An attempt to generate the largest diversity of primitive 3D shapes using the smallest amount of code.
// CS 174a Graphics Example Code (Javascript or C++ versions)

// Custom_Shapes.js - Defines a number of objects that inherit from class Shape.  All Shapes have certain arrays.  Each array manages either the Shape's 3D vertex
// positions, vertex normal vectors, 2D texture coordinates, and any other per-vertex quantity.  All subclasses of Shape inherit all these arrays.
// Upon instantiation, any Shape subclass populates these lists in their own way, and then automatically makes GL calls -- special kernel
// functions to copy each of the lists one-to-one into new buffers in the graphics card's memory.



// *********** SHAPE FROM FILE ***********
// Finally, here's a versatile standalone shape that imports all its arrays' data from an .obj file.  See webgl-obj-loader.js for the rest of the relevant code.

function Shape_From_File( filename, points_transform )
	{
		Shape.call(this);

		this.draw = function( graphicsState, model_transform, material ) 	{
		 	if( this.ready )
		 		Shape.prototype.draw.call(this, graphicsState, model_transform, material );		
		}

		this.filename = filename;
		this.points_transform = points_transform;

		this.webGLStart = function(meshes)
		{
			for( var j = 0; j < meshes.mesh.vertices.length/3; j++ )
			{
				this.positions.push( vec3( meshes.mesh.vertices[ 3*j ], meshes.mesh.vertices[ 3*j + 1 ], meshes.mesh.vertices[ 3*j + 2 ] ) );

				this.normals.push( vec3( meshes.mesh.vertexNormals[ 3*j ], meshes.mesh.vertexNormals[ 3*j + 1 ], meshes.mesh.vertexNormals[ 3*j + 2 ] ) );
				this.texture_coords.push( vec2( meshes.mesh.textures[ 2*j ],meshes.mesh.textures[ 2*j + 1 ]  ));
			}
			this.indices  = meshes.mesh.indices;

	        for( var i = 0; i < this.positions.length; i++ )                         // Apply points_transform to all points added during this call
	        {
	        	this.positions[i] = vec3( mult_vec( this.points_transform, vec4( this.positions[ i ], 1 ) ) );
	        	this.normals[i]  = vec3( mult_vec( transpose( inverse( this.points_transform ) ), vec4( this.normals[ i ], 1 ) ) );
	        }

			this.init_buffers();
			this.ready = true;
		}                                                 // Begin downloading the mesh, and once it completes return control to our webGLStart function
		OBJ.downloadMeshes( { 'mesh' : filename }, (function(self) { return self.webGLStart.bind(self) }(this) ) );
	}
inherit( Shape_From_File, Shape );

// *********** ROTATION DISK *******
Make_Shape_Subclass( "Rotation_Disk", Shape );
Rotation_Disk.prototype.populate = function (recipient, radius, sections, thickness) {
  // TODO: add rectangle strips in circle around middle
  var rotation_delta = 360 / sections;
  var segment_scale = Math.tan(Math.PI / sections) * radius * 2;

  for( var i = 0; i < sections; i++) {
    var square_transform = mult(rotation(i * rotation_delta, 0, 0, 1), translation(-radius, 0, 0));

    Old_Square.prototype.populate( recipient, mult(square_transform, scale(1, segment_scale, thickness)) );
  }

  var step = 1 / sections;
  var current = 0;
  for( var i = 0; i < recipient.positions.length; i += 4) {
  	recipient.texture_coords[i] = new vec2(current, 1);
  	recipient.texture_coords[i + 1] = new vec2(current + step, 1);
  	recipient.texture_coords[i + 2] = new vec2(current, 0);
  	recipient.texture_coords[i + 3] = new vec2(current + step, 0);
  	current += step;
  }
}

Make_Shape_Subclass( "Spiky_Ball", Shape );
Spiky_Ball.prototype.populate = function (recipient, rows, columns, radius, variation_height) {
	Sphere.prototype.populate(recipient, rows, columns, new mat4());

	console.log(recipient.positions);

	for(var i = 0; i < recipient.positions.length; i++) {
		var nVec = normalize(recipient.positions[i]);
		for(var j = 0; j < 3; j++) 
			recipient.positions[i][j] = (nVec[j] * radius) + (nVec[j] * Math.random() * variation_height);
	}

	recipient.flat_shade(0, 0, false);
};
