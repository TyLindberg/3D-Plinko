/*jslint node: true */
// *******************************************************
// CS 174a Graphics Example Code
// animation.js - The main file and program start point.  The class definition here describes how to display an Animation and how it will react to key and mouse input.  Right now it has 
// no meaningful scenes to draw - you will fill it in (at the bottom of the file) with all your shape drawing calls and any extra key / mouse controls.  

// Now go down to display() to see where the sample shapes you see drawn are coded, and where to fill in your own code.

"use strict";     // Selects strict javascript
var canvas, canvas_size, shaders, gl = null, g_addrs,          // Global variables
	thrust = vec3(), origin = vec3(0, 10, -15), looking = false, prev_time = 0, animate = false, animation_time = 0, gouraud = false, color_normals = false, camera_mode = 1, max_camera_modes = 3;
var fps = 0, current_num_frames = 0, fps_time_count = 0;
var show_pick_shader = false;

// *******************************************************
// IMPORTANT -- Any new variables you define in the shader programs need to be in the list below, so their GPU addresses get retrieved.

var shader_variable_names = [ "camera_transform", "camera_model_transform", "projection_camera_model_transform", "camera_model_transform_normal",
                              "shapeColor", "lightColor", "lightPosition", "attenuation_factor", "ambient", "diffusivity", "shininess", "smoothness", 
                              "animation_time", "COLOR_NORMALS", "GOURAUD", "USE_TEXTURE", "object_id" ];
   
function Color(r, g, b, a) { return vec4(r, g, b, a); }     // Colors are just special vec4s expressed as: ( red, green, blue, opacity )
function CURRENT_BASIS_IS_WORTH_SHOWING(self, model_transform) { 
    self.m_axis.draw(self.basis_id++, self.graphicsState, model_transform, new Material(Color(0.8, 0.3 ,0.8,1), 0.1, 1, 1, 40, undefined) ); }
var identity = new mat4();

// *******************************************************
// IMPORTANT -- In the line below, add the filenames of any new images you want to include for textures!

var texture_filenames_to_load = [ "stars.png", "text.png", "earth.gif", "RingTex.png", "GradientBGBlank.png" ];

// *******************************************************
// Matrix Multiplication Functions
function mult4x4(u, v) {
    var result = [];
    result.length = 4;
    result[0] = []; result[1] = []; result[2] = []; result[3] = [];
    result[0].length = 4; result[1].length = 4;
    result[2].length = 4; result[3].length = 4;

    for ( var i = 0; i < 4; ++i ) {

        for ( var j = 0; j < 4; ++j ) {
            var sum = 0.0;
            for ( var k = 0; k < 4; ++k ) {
                sum += u[i][k] * v[k][j];
            }
            result[i][j] = sum;
        }
    }

    result.matrix = true;

    return result;
}

// Found on StackOverflow - courtesy of A. Levy
function clone(obj) {
    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        var copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        var copy = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        var copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
}


// *******************************************************
// Object ID Storage

var current_id = 0;
var scene_objects = [];

var selected_material = new Material(Color(1, 1, 0, 1), 0.5, 1, 1, 20);

// Takes an id and converts it to RGB with each value in [0,1] range
function idToColor(id) {
    var alpha = 1;
    var b = Math.floor(id / (65536));
    var g = Math.floor((id - (b * 65536)) / 255);
    var r = id % 255;

    return Color(r / 255, g / 255, b / 255, 1);
}

function color255toid(color_in) {
    var r = color_in[0];
    var g = color_in[1];
    var b = color_in[2];
    return r + (g * 255) + (b * 65536);
}

// Takes RGB in [0,1] range and converts to an id
function RGBToID(r, g, b) {
    return Math.floor(255 * (r + (g * 255) + (b * 65536)));
}


// *******************************************************
// Physics Object Logic

var grid_size = 52; // MUST BE 3 OR GREATER (add two to create buffer on the sides of the grid)
var kinematic_grid = createPhysicsGrid(grid_size);
var dynamic_grid = createPhysicsGrid(grid_size);
var used_dynamic_grid_spaces = [];

var collision_damping = 0.8;

var physics_objects = [];
var dynamic_physics_objects = [];
var kinematic_physics_objects = [];

var max_dynamic_objects = 100;
var current_dynamic_obj_index = 0;

var plinko_size = new vec3(10, 5, 10); // Size from origin, so 5 = 10 across
var plinko_step = 2;                                     // Use multiples of 2.5

var rainbow_materials = {red: new Material(Color(1, 0, 0, 1), .4, .4, .8, 20 ),
                         orange: new Material(Color(1, 0.498, 0, 1), .4, .4, .8, 20 ),
                         yellow: new Material(Color(1, 1, 0, 1), .4, .4, .8, 20 ),
                         green: new Material(Color(0, 1, 0, 1), .4, .4, .8, 20 ),
                         teal: new Material(Color(0.259, 0.882, 0.929, 1), .4, .4, .8, 20 ),
                         blue: new Material(Color(0, 0, 1, 1), .4, .4, .8, 20 ),
                         violet: new Material(Color(0.561, 0, 1, 1), .4, .4, .8, 20 )};

var rainbow_materials_textured;

function indexToRainbowMaterial(index, textured = false) {
    if(!textured) {
        switch(index % 7) {
            case 0:
            return rainbow_materials.red;
            case 1:
            return rainbow_materials.orange;
            case 2:
            return rainbow_materials.yellow;
            case 3:
            return rainbow_materials.green;
            case 4:
            return rainbow_materials.teal;
            case 5:
            return rainbow_materials.blue;
            case 6:
            return rainbow_materials.violet;
            default:
            console.log("Incorrect index type");
        }
    }
    else {
        switch(index % 7) {
            case 0:
            return rainbow_materials_textured.red;
            case 1:
            return rainbow_materials_textured.orange;
            case 2:
            return rainbow_materials_textured.yellow;
            case 3:
            return rainbow_materials_textured.green;
            case 4:
            return rainbow_materials_textured.teal;
            case 5:
            return rainbow_materials_textured.blue;
            case 6:
            return rainbow_materials_textured.violet;
            default:
            console.log("Incorrect index type");
        }
    }
}
var color_transfer_step = 50 / 256;

function createPhysicsGrid(size) {
    var grid = [];
    var i, j, k;
    grid.length = size;
    for(i = 0; i < size; i++) {
        grid[i] = [];
        grid[i].length = size;
        for(j = 0; j < size; j++) {
            grid[i][j] = [];
            grid[i][j].length = size;
            for(k = 0; k < size; k++) {
                grid[i][j][k] = [];
            }
        }
    }

    return grid;
}

function clearPhysicsGrid(grid, size) {
    for(var i = 0; i < used_dynamic_grid_spaces.length; i++) {
        var grid_space = used_dynamic_grid_spaces[i];
        grid[grid_space[0]][grid_space[1]][grid_space[2]] = [];
    }
    used_dynamic_grid_spaces = [];
}

function populateDynamicPhysicsGrid(grid, size, entities) {
    clearPhysicsGrid(grid, size);

    for(var i = 0; i < entities.length; i++) {
        var physics_obj = entities[i];
        var offset = Math.floor(size / 2);
        var x = Math.max(Math.min(Math.floor(physics_obj.translation_vec[0]) + offset, size - 2), 1);
        var y = Math.max(Math.min(Math.floor(physics_obj.translation_vec[1]) + offset, size - 2), 1);
        var z = Math.max(Math.min(Math.floor(physics_obj.translation_vec[2]) + offset, size - 2), 1);

        grid[x][y][z].push(physics_obj);
        used_dynamic_grid_spaces.push(new vec3(x, y, z));
        physics_obj.physics_grid_pos = new vec3(x, y, z);
    }
}

function addToPhysicsGrid(grid, size, physics_obj) {
    // Remove the element if it already exists in the grid
    var currentGridPos = physics_obj.physics_grid_pos;
    var currentIndex = grid[currentGridPos[0]][currentGridPos[1]][currentGridPos[2]].indexOf(physics_obj);
    if(currentIndex > -1) {
        grid.splice(currentIndex, 1);
    }

    // Add the element to the new grid position
    var offset = Math.floor(size / 2);
    var x = Math.max(Math.min(Math.floor(physics_obj.translation_vec[0]) + offset, size - 2), 1);
    var y = Math.max(Math.min(Math.floor(physics_obj.translation_vec[1]) + offset, size - 2), 1);
    var z = Math.max(Math.min(Math.floor(physics_obj.translation_vec[2]) + offset, size - 2), 1);

    // Update grid and store position in the object
    grid[x][y][z].push(physics_obj);
    physics_obj.physics_grid_pos = new vec3(x, y, z);
}

function simulatePhysics(timestep) {
    // Only simulate physics if the scene is animating
    if(animate) {
        // Simulate gravity
        for (var i = 0; i < dynamic_physics_objects.length; i++) {
            var physics_obj = dynamic_physics_objects[i];
            physics_obj.simulateGravity(timestep);
        }

        // Establish grid positions
        populateDynamicPhysicsGrid(dynamic_grid, grid_size,
                                   dynamic_physics_objects);

        // Resolve kinematic collisions and bounces
        for(var i = 0; i < dynamic_physics_objects.length; i++) {
            var physics_obj = dynamic_physics_objects[i];
            resolveKinematicCollision(physics_obj);
        }
    }
}

function resolveKinematicCollision(obj1) {
    var pos = obj1.physics_grid_pos;
    var x, y, z, i, collision_obj, offset_vector;
    for(x = pos[0] - 1; x <= pos[0] + 1; x++) {
        for(y = pos[1] - 1; y <= pos[1] + 1; y++) {
            for(z = pos[2] - 1; z <= pos[2] + 1; z++) {
                for(i = 0; i < kinematic_grid[x][y][z].length; i++) {
                    collision_obj = kinematic_grid[x][y][z][i];
                    if(collision_obj != obj1
                        && checkCollision(obj1, collision_obj)) {

                        kinematicCollision(obj1, collision_obj);

                        return;
                    }
                }
            }
        }
    }
}

function checkCollision(obj1, obj2) {
    var pos1 = obj1.translation_vec, pos2 = obj2.translation_vec;
    var offset_vector = new vec3(pos1[0] - pos2[0],
                                 pos1[1] - pos2[1],
                                 pos1[2] - pos2[2]);
    var sqrDistance = offset_vector[0] * offset_vector[0] +
                      offset_vector[1] * offset_vector[1] +
                      offset_vector[2] * offset_vector[2];

    return sqrDistance < (obj1.radius + obj2.radius) * (obj1.radius + obj2.radius);
}

function kinematicCollision(obj, k_obj) {
    var obj_pos = obj.translation_vec, k_obj_pos = k_obj.translation_vec;
    var vel = obj.velocity;
    var xDir = new vec3( obj_pos[0] - k_obj_pos[0],
                         obj_pos[1] - k_obj_pos[1],
                         obj_pos[2] - k_obj_pos[2]);
    var nxDir = new vec3(xDir[0], xDir[1], xDir[2]);
    nxDir = normalize(nxDir, false);

    // Reflect the vector along this normal
    // r = d - 2(d * n)n
    var reflected_vel = new vec3();
    var TwoDdotN = 2 * (nxDir[0] * vel[0] + nxDir[1] * vel[1] + nxDir[2] * vel[2])
    for(var i = 0; i < 3; i++) {
        reflected_vel[i] = (vel[i] - (TwoDdotN * nxDir[i])) * collision_damping;
    }

    obj.velocity = reflected_vel;

    // Displace the object to not be colliding with the sphere
    var displacement = new vec3();
    var distance = (obj.radius + k_obj.radius) - length(xDir);
    // console.log(distance);
    for(var i = 0; i < 3; i++) {
        displacement[i] = nxDir[i] * distance;
    }
    obj.translateLocal(displacement[0], displacement[1], displacement[2]);

    materialTransfer(obj, k_obj);
}

function dynamicCollision(obj1, obj2) {
    var obj1_pos = obj1.translation_vec, obj2_pos = obj2.translation_vec;
    var vel1 = obj1.velocity, vel2 = obj2.velocity;
    var xDir = new vec3( obj1_pos[0] - obj2_pos[0],
                         obj1_pos[1] - obj2_pos[1],
                         obj1_pos[2] - obj2_pos[2]);
    var nxDir = new vec3(xDir[0], xDir[1], xDir[2]);
    nxDir = normalize(nxDir, false);

    // Unfinished
}

function materialTransfer(obj1, obj2) {
    obj2.material = obj1.material;
}

function objectColorTransfer(obj1, obj2) {
    if(obj1.material === null || obj2.material === null)
        return;

    // Red
    if(obj1.color[0] > obj2.color[0]) {
        obj1.color[0] -= color_transfer_step;
        obj2.color[1] += color_transfer_step;
        obj2.color[2] += color_transfer_step;
    }
    else if (obj2.color[0] > obj1.color[0]) {
        obj2.color[0] -= color_transfer_step;
        obj1.color[1] += color_transfer_step;
        obj1.color[2] += color_transfer_step;
    }

    // Green
    if(obj1.color[1] > obj2.color[1]) {
        obj1.color[1] -= color_transfer_step;
        obj2.color[0] += color_transfer_step;
        obj2.color[2] += color_transfer_step;
    }
    else if (obj2.color[1] > obj1.color[1]) {
        obj2.color[1] -= color_transfer_step;
        obj1.color[0] += color_transfer_step;
        obj1.color[2] += color_transfer_step;
    }

    // Blue
    if(obj1.color[2] > obj2.color[2]) {
        obj1.color[2] -= color_transfer_step;
        obj2.color[0] += color_transfer_step;
        obj2.color[1] += color_transfer_step;
    }
    else if (obj2.color[2] > obj1.color[2]) {
        obj2.color[2] -= color_transfer_step;
        obj1.color[0] += color_transfer_step;
        obj1.color[1] += color_transfer_step;
    }

    for(var i = 0; i < 3; i++) {
        obj1.color[i] = Math.max(0, Math.min(1, obj1.color[i]));
        obj2.color[i] = Math.max(0, Math.min(1, obj2.color[i]));
    }

    obj1.material.color = obj1.color;
    obj2.material.color = obj2.color;
}

function translationM2V(matrix) {
    return new vec3(matrix[0][3], matrix[1][3], matrix[2][3]);
}

window.onload = function init() {	var anim = new Animation();	}   // Our whole program's entry point


// *******************************************************
// *******************************************************
// *******************************************************
// Custom Object Code
//
var StaticObject = function (graphicsState, mesh, material, translation,
                             rotation, scale) {
	(function init(oThis) {
		oThis.graphicsState = graphicsState;
		oThis.mesh = mesh;
		oThis.material = material;
	
		oThis.translation = translation;
		oThis.rotation = rotation;
		oThis.scale = scale;
	
		oThis.transform = mult4x4(translation, mult4x4(rotation, scale));
		oThis.finalTransform = oThis.transform;
	
		oThis.parent = null;
		oThis.children = [];
	})(this);
};

// Don't use this directly
StaticObject.prototype.addParent = function(parent) {
	if(this.parent === null) {
		this.parent = parent;
		this.finalTransform = mult4x4(parent.transform, this.transform);
	}
	else {
		console.log("This object already has a parent");
	}
};

StaticObject.prototype.addChild = function(child) {
    var i, length = this.children.length;
	for(i = 0; i < length; i++) {
		if(child === this.children[i]) {
			console.log("This object is already a child.");
			return;
		}
	}
	this.children.push(child);
	child.addParent(this);
    return child;
};

StaticObject.prototype.draw = function() {
	if(this.mesh !== null) {
		this.mesh.draw(this.graphicsState, this.finalTransform, this.material);
	}
};

StaticObject.prototype.drawChildren = function() {    
    var i, length = this.children.length;
    for(i = 0; i < length; i++) {
        this.children[i].draw();
    }
};

StaticObject.prototype.drawRecursive = function() {
    this.draw();

    var i, length = this.children.length;
    for(i = 0; i < length; i++) {
        this.children[i].drawRecursive();
    }
};


var DynamicObject = function(graphicsState, mesh, material,
                              translation, rotation, scale,
                              usePhysics = false, is_kinematic = false) {
    (function init(oThis) {
		oThis.graphicsState = graphicsState;
		oThis.mesh = mesh;
		oThis.material = material;
        if(material !== null) {
            oThis.color = material.color;
        }
        else {
            oThis.color = Color(1, 1, 1, 1);
        }
	
		oThis.translation = translation;
        oThis.translation_vec = new vec3(translation[0][3],
                                         translation[1][3],
                                         translation[2][3]);
		oThis.rotation = rotation;
		oThis.scale = scale;
	
        oThis.rigidbodyTransform = mult4x4(translation, rotation);
		oThis.transform = mult4x4(oThis.rigidbodyTransform, scale);
        oThis.dirty = false;
	
		oThis.parent = null;
		oThis.children = [];

        // Physics initialization
        oThis.usePhysics = usePhysics;
        oThis.is_kinematic = is_kinematic;
        oThis.velocity = new vec3(0, 0, 0);
        oThis.radius = oThis.scale[0][0];
        oThis.gravity = new vec3(0, /*-0.01*/ -0.25, 0);
        oThis.physics_grid_pos = new vec3(1, 1, 1);

        if(oThis.usePhysics) {
            physics_objects.push(oThis);

            if(oThis.is_kinematic) {
                kinematic_physics_objects.push(oThis);
                addToPhysicsGrid(kinematic_grid, grid_size, oThis);
                oThis.gravity = new vec3(0, 0, 0);
            }
            else {
                dynamic_physics_objects.push(oThis);
            }
        }

        // Object ID initialization
        if(current_id >= 16777215) {
            alert("Exceeded maximum number of objects in scene: 16,777,215");
        }

        oThis.id = current_id;
        oThis.id_color = idToColor( current_id );
        // console.log("r: " + oThis.id_color[0] + " g: " + oThis.id_color[1] + " b: " + oThis.id_color[2]);

        oThis.selected = false;

        // console.log(oThis.id_color);

        scene_objects.push(oThis);
        current_id += 1;

	})(this);
};

DynamicObject.prototype.simulateGravity = function(timestep) {
    // Only account for gravity
    this.velocity[1] += this.gravity[1] * timestep;

    this.translateLocal(this.velocity[0], this.velocity[1], this.velocity[2]);
};

DynamicObject.prototype.addParent = function(parent) {
    if(parent === this) {
        console.log("An object cannot be a parent of itself!");
        return;
    }

	if(this.parent === null) {
		this.parent = parent;
	}
	else {
		console.log("This object already has a parent");
	}
};

DynamicObject.prototype.changeParent = function(parent) {
    if(parent === this) {
        console.log("An object cannot be a parent of itself!");
        return;
    }

    this.parent = parent;
};

DynamicObject.prototype.addChild = function(child) {
    if(child === this) {
        console.log("An object cannot be a child of itself!");
        return;
    }

    var i, length = this.children.length;
	for(i = 0; i < length; i++) {
		if(child === this.children[i]) {
			console.log("This object is already a child.");
			return;
		}
	}
	this.children.push(child);
	child.addParent(this);
    return child;
};

DynamicObject.prototype.right = function() {
    if(this.dirty) {
        this.recalculateTransform();
    }
    return mult_vec(this.rigidbodyTransform, new vec4(1, 0, 0, 0));
};

DynamicObject.prototype.up = function() {
    if(this.dirty) {
        this.recalculateTransform();
    }
    return mult_vec(this.rigidbodyTransform, new vec4(0, 1, 0, 0));
};

DynamicObject.prototype.forward = function() {
    if(this.dirty) {
        this.recalculateTransform();
    }
    return mult_vec(this.rigidbodyTransform, new vec4(0, 0, 1, 0));
};

DynamicObject.prototype.getLocalTransform = function() {
    if(this.dirty) {
        this.recalculateTransform();
    }

    if(this.parent === null)
        return this.transform;
    else
        return mult4x4(this.parent.getLocalTransform(), this.transform);
}

DynamicObject.prototype.getLocalRigidbodyTransform = function() {
    if(this.dirty) {
        this.recalculateTransform();
    }

    if(this.parent === null)
        return this.rigidbodyTransform;
    else
        return mult4x4(this.parent.getLocalRigidbodyTransform(), this.rigidbodyTransform);
}

DynamicObject.prototype.translateLocal = function(x, y, z) {
    this.translation_vec[0] += x;
    this.translation_vec[1] += y;
    this.translation_vec[2] += z;
    this.translation = mult4x4(this.translation, translation(x, y, z));
    this.dirty = true;
};

DynamicObject.prototype.setLocalTranslation = function (x, y, z) {
    this.translation_vec[0] = x;
    this.translation_vec[1] = y;
    this.translation_vec[2] = z;
    this.translation = translation(x, y, z);
    this.dirty = true;
};

DynamicObject.prototype.rotateLocal = function(angle, x, y, z) {
    this.rotation = mult4x4(this.rotation, rotation(angle, x, y, z));
    this.dirty = true;
};

DynamicObject.prototype.setLocalRotation = function (angle, x, y, z) {
    this.rotation = rotation(angle, x, y, z);
    this.dirty = true;
};

DynamicObject.prototype.scaleLocal = function (x, y, z) {
    this.scale = mult4x4(this.scale, scale(x, y, z));
    this.dirty = true;
};

DynamicObject.prototype.setLocalScale = function (x, y, z) {
    this.scale = scale(x, y, z);
    this.dirty = true;
};

DynamicObject.prototype.recalculateTransform = function() {
    this.rigidbodyTransform = mult4x4(this.translation, this.rotation);
    this.transform = mult4x4(this.rigidbodyTransform, this.scale);
    this.dirty = false;
};

DynamicObject.prototype.draw = function(finalTransform, selected = false) {
    if(this.dirty) {
        this.recalculateTransform();
    }
	if(this.mesh !== null) {
        var draw_material = this.material;
        if(selected) {
            draw_material = selected_material;
        }

        // this.material.color = this.color;
		this.mesh.draw_w_id(this.graphicsState, finalTransform, draw_material, this.id_color);
	}
};

DynamicObject.prototype.drawChildren = function(parentTransform, selected = false) {    
    var i, length = this.children.length,
        finalTransform = mult4x4(parentTransform, this.transform);
    for(i = 0; i < length; i++) {
        this.children[i].draw(finalTransform);
    }
};

DynamicObject.prototype.drawRecursive = function(parentTransform, selected = false) {
    var finalTransform = mult4x4(parentTransform, this.transform);
    if(!selected) {
        selected = this.selected;
    }
    this.draw(finalTransform, selected);

    var i, length = this.children.length;
    for(i = 0; i < length; i++) {
        this.children[i].drawRecursive(finalTransform, selected);
    }
};

function createPhysicsSphere(anim, material, translation) {
    // Reuse old object
    if(dynamic_physics_objects.length >= max_dynamic_objects) {
        var nT = translationM2V(translation);
        dynamic_physics_objects[current_dynamic_obj_index].setLocalTranslation(nT[0], nT[1], nT[2]);
        dynamic_physics_objects[current_dynamic_obj_index].material = material;
        dynamic_physics_objects[current_dynamic_obj_index].velocity = new vec3();

        current_dynamic_obj_index = (current_dynamic_obj_index + 1) % max_dynamic_objects;
        console.log("Reused");
        return null;
    } else {
        return new DynamicObject(anim.graphicsState, anim.m_sub, material,
            translation, identity, scale(0.5, 0.5, 0.5), true, false);
    }
}

function createKinematicSphere(anim, material, translation) {
    return new DynamicObject(anim.graphicsState, anim.m_sub, material,
        translation, identity, scale(0.25, 0.25, 0.25), true, true);
}

function createDispenserCircle(anim, base_translation, radius, tiltMagnitude = 15, spinSpeed = -5) {
    var _dispensers = [];

    var _base = new DynamicObject(anim.graphicsState, null, null,
        base_translation, identity, identity);
    var base2 = new DynamicObject(anim.graphicsState, null, null,
        identity, identity, identity);
    _base.addChild(base2);

    var circleBase = new DynamicObject(anim.graphicsState, null, null,
        identity, identity, identity);
    base2.addChild(circleBase);

    var rotationStep = 360 / 7;
    for(var i = 0; i < 7; i++) {
        var emptyRotate = new DynamicObject(anim.graphicsState, null, null,
        identity, rotation(rotationStep * i, 0, 1, 0), identity);
        circleBase.addChild(emptyRotate);

        var dispenser = new DynamicObject(anim.graphicsState, anim.m_spiky_ball, indexToRainbowMaterial(i, true),
            translation(0, 0, radius), rotation(90, 1, 1, 1), scale(0.5, 0.5, 0.5));
        var dispenser_decoration = new DynamicObject(anim.graphicsState, anim.m_rotation_disk, indexToRainbowMaterial(i, true),
            identity, identity, scale(2, 2, 2));
        dispenser.addChild(dispenser_decoration);
        emptyRotate.addChild(dispenser);
        _dispensers.push(dispenser);

        anim.dynamicFunctions.push({objects: [dispenser], update: function(dObj, time) {
            var offset = clone(i);
            dObj.setLocalTranslation(0, 0, radius + Math.abs(radius - 2) * Math.sin((time / 1000) + offset * (1 / 700) ));
            dObj.setLocalRotation(time / 20, 0.5, 0.3, 0.1);
            // dObj.setLocalRotation()
        }});
        anim.dynamicFunctions.push({objects: [dispenser_decoration], update: function(dObj, time) {
            dObj.setLocalRotation(time / 10, 0, 1, 0 );
        }});
    }

    // Add animations
    anim.dynamicFunctions.push({objects: [_base], update: function(dObj, time) {
        dObj.setLocalRotation(Math.sin(time / 1000) * tiltMagnitude, 0, 0, 1);
    }});
    anim.dynamicFunctions.push({objects: [base2], update: function(dObj, time) {
        dObj.setLocalRotation(Math.sin(time / 500) * tiltMagnitude, 1, 0, 0);
    }});
    anim.dynamicFunctions.push({objects: [circleBase], update: function(dObj, time) {
        dObj.setLocalRotation((time / 100) * spinSpeed, 0, 1, 0);
    }});

    return {base: _base, dispensers: _dispensers};
}

function dispense(anim) {
    if(animate) {
        var locationTransform = anim.dispensers[anim.dispense_index].getLocalRigidbodyTransform();
        locationTransform = translation(locationTransform[0][3],
                                        locationTransform[1][3],
                                        locationTransform[2][3]);
        var newSphere = createPhysicsSphere(anim,
            indexToRainbowMaterial(anim.dispense_index),
            locationTransform);
        if(newSphere !== null)
            anim.dynamicPhysicsObjects.addChild(newSphere);

        anim.dispense_index = (anim.dispense_index + 1) % 7;
    }
}

// *******************************************************	
// When the web page's window loads it creates an "Animation" object.  It registers itself as a displayable object to our other class "GL_Context" -- 
// which OpenGL is told to call upon every time a draw / keyboard / mouse event happens.
function Animation()    // A class.  An example of a displayable object that our class GL_Context can manage.
{
	( function init( self )
	{
        self.bg_color = /*Color( 0.1, 0.8, 0.9, 1 )*/Color(0, 0, 0, 0);
		self.context = new GL_Context( "gl-canvas", self.bg_color);    // Set your background color here
		self.context.register_display_object( self );
        canvas.style.background = "url(http://i.imgur.com/NMIonVF.png)";
		
    shaders = { "Default":     new Shader( "vertex-shader-id", "fragment-shader-id" ), 
                "Demo_Shader": new Shader( "vertex-shader-id", "demo-shader-id"     ),
                "Pick_Shader": new Shader( "vertex-shader-id", "pick-shader-id")  };
    
		for( var i = 0; i < texture_filenames_to_load.length; i++ )
			initTexture( texture_filenames_to_load[i], true );

    rainbow_materials_textured = {red: new Material(Color(1, 0, 0, 1), .4, .4, .8, 20, "RingTex.png" ),
                         orange: new Material(Color(1, 0.498, 0, 1), .4, .4, .8, 20, "RingTex.png" ),
                         yellow: new Material(Color(1, 1, 0, 1), .4, .4, .8, 20, "RingTex.png" ),
                         green: new Material(Color(0, 1, 0, 1), .4, .4, .8, 20, "RingTex.png" ),
                         teal: new Material(Color(0.259, 0.882, 0.929, 1), .4, .4, .8, 20, "RingTex.png" ),
                         blue: new Material(Color(0, 0, 1, 1), .4, .4, .8, 20, "RingTex.png" ),
                         violet: new Material(Color(0.561, 0, 1, 1), .4, .4, .8, 20, "RingTex.png" )};
    self.mouse = { "from_center": vec2() };
		            
    self.m_strip       = new Old_Square();                // At the beginning of our program, instantiate all shapes we plan to use, 
	self.m_tip         = new Tip( 3, 10 );                // each with only one instance in the graphics card's memory.
    self.m_cylinder    = new Cylindrical_Tube( 10, 10 );  // For example we'll only create one "cube" blueprint in the GPU, but we'll re-use 
    self.m_torus       = new Torus( 25, 25 );             // it many times per call to display to get multiple cubes in the scene.
    self.m_sphere      = new Sphere( 50, 50 );
    self.poly          = new N_Polygon( 7 );
    self.m_cone        = new Cone( 10, 10 );
    self.m_capped      = new Capped_Cylinder( 4, 12 );
    self.m_prism       = new Prism( 8, 8 );
    self.m_cube        = new Cube();
    self.m_obj         = new Shape_From_File( "teapot.obj", scale( .1, .1, .1 ) );
    self.m_sub         = new Subdivision_Sphere( 3, false );
    self.m_axis        = new Axis();

    // Custom Shape
    self.m_rotation_disk = new Rotation_Disk( 0.5, 6, 0.2 );
    self.m_spiky_ball    = new Spiky_Ball(10, 10, 0.5, 0.2);

    // ********************************************
    // Selected Object Variables
    self.selected_object = null;
    self.selected_id = null;

    // ********************************************
    // Pick Buffer Setup

    // Create empty texture
    self.pick_texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, self.pick_texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1024, 1024, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.generateMipmap(gl.TEXTURE_2D);

    // Create and bind framebuffer
    self.pick_framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, self.pick_framebuffer);

    // Attach color buffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D, self.pick_texture, 0);

    // Check for completeness
    var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if(status != gl.FRAMEBUFFER_COMPLETE)
        alert('Framebuffer Not Complete!');

    // Unbind the pick_framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);


    // ********************************************
    // Physics Setup

    // window.setInterval(function() { simulatePhysics(1 / 50); }, 1000 / 50);

		
// 1st parameter is our starting camera matrix.  2nd parameter is the projection:  The matrix that determines how depth is treated.  It projects 3D points onto a plane.
		self.graphicsState = new GraphicsState( mult(mult(rotation(30, 1, 0, 0), rotation(-45, 0, 1, 0)), translation(-22, -17, -22)), perspective(45, canvas.width/canvas.height, .1, 1000), 0 );
        
        // **********************************************
        // Add static objects to list
        self.staticObjects = new StaticObject(self.graphicsState, null, null,
                                              identity, identity, identity);

        // self.staticObjects.addChild(createGround(0, -10, -15, self));

        // **********************************************
        // Camera Stuff
        self.cameraRotator = new DynamicObject(self.graphicsState, null, null,
                                          identity, identity, identity);
        self.cameraPlaceholder = new DynamicObject(self.graphicsState, null, null,
                                          translation(22, 17, 22),
                                          mult(rotation(45, 0, 1, 0), rotation(-30, 1, 0, 0)),
                                          identity);
        self.cameraPlaceholderLow = new DynamicObject(self.graphicsState, null, null,
                                          translation(22, plinko_size[1] / 2, 22),
                                          rotation(45, 0, 1, 0),
                                          identity);
        self.cameraRotator.addChild(self.cameraPlaceholder);
        self.cameraRotator.addChild(self.cameraPlaceholderLow);

        function cameraOrbit(dObj, time) {
            dObj.setLocalRotation(time * 0.005, 0, 1, 0);
        }
        
        // **********************************************
        // Add dynamic objects to list
        self.dynamicObjects = new DynamicObject(self.graphicsState, null, null,
                                          identity, identity, identity);
        self.dynamicFunctions = [];

        self.kinematicObjects = new DynamicObject(self.graphicsState, null, null,
                                          identity, identity, identity);

        self.dynamicPhysicsObjects = new DynamicObject(self.graphicsState, null, null,
                                          identity, identity, identity);


        self.dynamicObjects.addChild(self.kinematicObjects);
        self.dynamicObjects.addChild(self.dynamicPhysicsObjects);

        self.dynamicFunctions.push({ objects: [self.cameraRotator],
                                     update: cameraOrbit });

        // Generate the plinko grid of static physics objects
        var dynamicMat = new Material(Color(1, 0, 0, 1), .7, .4, .2, 20 );
        var kinematicMat = new Material(Color(1, 1, 1, 1), .4, .4, .8, 20 );
        var offset = 0;
        var third_step = plinko_step / 3;
        var steps = 0;
        for(var y = -plinko_size[1]; y <= plinko_size[1]; y += plinko_step) {
            for(var x = -plinko_size[0] + offset; x <= plinko_size[0]; x += plinko_step) {
                for (var z = -plinko_size[2] + offset; z <= plinko_size[2]; z+= plinko_step) {
                    self.kinematicObjects.addChild(createKinematicSphere(self, kinematicMat,
                                              translation(x,
                                                          y,
                                                          z)));
                }
            }
            steps++;
            offset += third_step;
            if(steps == 3) {
                steps = 0;
                offset = 0;
            }
        }

        var dispenserCircle = createDispenserCircle(self, translation(0, plinko_size[1] + 5, 0), 5);
        self.dynamicObjects.addChild(dispenserCircle.base);

        self.dispensers = dispenserCircle.dispensers;
        self.dispense_index = 0;
        self.dispense_time = 0;

        // Amount of time taken to dispense in ms
        self.dispenseTime = 250;
        self.dispenseTimer = 0;
        // setInterval(function() { dispense(self); }, 250);

        // Create Floor
        // for(var x = -15; x <= 15; x++) {
        //     for(var z = -15; z <= 15; z++) {
        //         self.kinematicObjects.addChild(createKinematicSphere(self, kinematicMat,
        //                                       translation(x,
        //                                                   -7,
        //                                                   z)));
        //     }
        // }

        // for(var y = 0; y < 6; y += 2) {
        //     for(var x = -5; x <= 5; x += 2) {
        //         for(var z = -5; z <= 5; z += 2) {
        //             self.dynamicPhysicsObjects.addChild(
        //                 createPhysicsSphere(self, dynamicMat,translation(x + Math.random(), 7 + y, z + Math.random())));
        //         }
        //     }
        // }
        
		self.context.render();	
	} ) ( this );
	
// *** Mouse controls: ***
  var mouse_position = function( e ) { return vec2( e.clientX - canvas.width/2, e.clientY - canvas.height/2 ); };   // Measure mouse steering, for rotating the flyaround camera.     
  canvas.addEventListener("mouseup",   ( function(self) { return function(e)	{ e = e || window.event;	self.mouse.anchor = undefined;              } } ) (this), false );
  canvas.addEventListener("mousedown", ( function(self) { return function(e)	{
    e = e || window.event;

    gl.enable(gl.CULL_FACE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, self.pick_framebuffer);
    gl.clearColor.apply( gl, Color(1, 1, 1, 1) );
    gl.clear(gl.COLOR_BUFFER_BIT);

    shaders["Pick_Shader"].activate();
    // Render the scene to the framebuffer
    self.dynamicObjects.drawRecursive(identity);

    shaders["Default"].activate();

    var mouse_x = e.offsetX;
    var mouse_y = canvas.height - e.offsetY;

    var color = new Uint8Array(4);
    gl.readPixels(mouse_x, mouse_y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, color);
    console.log("x: " + mouse_x + " y: " + mouse_y);
    console.log(color);

    var selected_id = color255toid(color);
    if(selected_id < scene_objects.length) {
        if(self.selected_object !== null) {
            self.selected_object.selected = false;
        }
        self.selected_object = scene_objects[selected_id];
        self.selected_id = selected_id;
        self.selected_object.selected = true;
    }
    else /*if(selected_id >= 16777214)*/ {
        if(self.selected_object !== null) {
            self.selected_object.selected = false;
        }
        self.selected_object = null;
        self.selected_id = null;
    }

    gl.disable(gl.CULL_FACE);

    gl.clearColor.apply( gl, self.bg_color);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    self.mouse.anchor = mouse_position(e); 
} } ) (this), false );
  canvas.addEventListener("mousemove", ( function(self) { return function(e)	{ e = e || window.event;    self.mouse.from_center = mouse_position(e); } } ) (this), false );                                         
  canvas.addEventListener("mouseout",  ( function(self) { return function(e)	{ self.mouse.anchor = undefined; self.mouse.from_center = vec2(); }; } ) (this), false );        // Stop steering if the mouse leaves the canvas. 
}
  
// *******************************************************	
// init_keys():  Define any extra keyboard shortcuts here
Animation.prototype.init_keys = function()
{
	shortcut.add( "Space", function() { thrust[1] = -1; } );			shortcut.add( "Space", function() { thrust[1] =  0; }, {'type':'keyup'} );
	shortcut.add( "z",     function() { thrust[1] =  1; } );			shortcut.add( "z",     function() { thrust[1] =  0; }, {'type':'keyup'} );
	shortcut.add( "w",     function() { thrust[2] =  1; } );			shortcut.add( "w",     function() { thrust[2] =  0; }, {'type':'keyup'} );
	shortcut.add( "a",     function() { thrust[0] =  1; } );			shortcut.add( "a",     function() { thrust[0] =  0; }, {'type':'keyup'} );
	shortcut.add( "s",     function() { thrust[2] = -1; } );			shortcut.add( "s",     function() { thrust[2] =  0; }, {'type':'keyup'} );
	shortcut.add( "d",     function() { thrust[0] = -1; } );			shortcut.add( "d",     function() { thrust[0] =  0; }, {'type':'keyup'} );
    // shortcut.add( "DOMMouseScroll", function(e) {
    //     var e = window.event || e;
    //     var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
    //     thrust[2] = delta;
    //     console.log("mousewheelscroll");
    //     return false;
    // });

    // function MouseWheelZoom(e) {
    //     var e = window.event || e;
    //     var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
    //     thrust[2] = delta;
    //     console.log("mousewheelscroll");
    //     e.preventDefault();
    //     e.stopPropagation();
    //     return false;
    // }

    // if(canvas.addEventListener) {
    //     canvas.addEventListener("mousewheel", MouseWheelZoom, false);

    //     canvas.addEventListener("DOMMouseScroll", MouseWheelZoom, false);
    // }

	shortcut.add( "f",     function() { looking = !looking; } );
	shortcut.add( ",",   ( function(self) { return function() { self.graphicsState.camera_transform = mult( rotation( 3, 0, 0,  1 ), self.graphicsState.camera_transform       ); } } ) (this) ) ;
	shortcut.add( ".",   ( function(self) { return function() { self.graphicsState.camera_transform = mult( rotation( 3, 0, 0, -1 ), self.graphicsState.camera_transform       ); } } ) (this) ) ;
  shortcut.add( "o",   ( function(self) { return function() { origin = vec3( mult_vec( inverse( self.graphicsState.camera_transform ), vec4(0,0,0,1) )                       ); } } ) (this) ) ;
	shortcut.add( "r",   ( function(self) { return function() { self.graphicsState.camera_transform = mat4(); }; } ) (this) );
	shortcut.add( "ALT+g", function() { gouraud = !gouraud; } );
	shortcut.add( "ALT+n", function() { color_normals = !color_normals;	} );
	shortcut.add( "ALT+a", function() { animate = !animate; } );
	shortcut.add( "p",     ( function(self) { return function() { self.m_axis.basis_selection++; }; } ) (this) );
	shortcut.add( "m",     ( function(self) { return function() { self.m_axis.basis_selection--; }; } ) (this) );

    // Change camera motion
    shortcut.add("c", function() {camera_mode = (camera_mode + 1) % max_camera_modes;});
    shortcut.add("p", function() {show_pick_shader = !show_pick_shader;});
}

Animation.prototype.update_strings = function( debug_screen_strings )	      // Strings that this displayable object (Animation) contributes to the UI:	
{
    if(fps_time_count > 1000) {
        fps_time_count -= 1000;
        fps = current_num_frames;
        current_num_frames = 0;
    }

    debug_screen_strings.string_map["framerate"]     = "Frame Rate: " + fps;

	debug_screen_strings.string_map["time"]    = "Animation Time: " + this.graphicsState.animation_time/1000 + "s";
	debug_screen_strings.string_map["basis"]   = "Showing basis: " + this.m_axis.basis_selection;
	debug_screen_strings.string_map["animate"] = "Animation " + (animate ? "on" : "off") ;
	debug_screen_strings.string_map["thrust"]  = "Thrust: " + thrust;
}

function update_camera( self, animation_delta_time )
{
    console.log(camera_mode);
    if(camera_mode > 0) {
        switch(camera_mode) {
        case 1:
            self.graphicsState.camera_transform = 
            inverse(self.cameraPlaceholder.getLocalRigidbodyTransform());
            break;
        case 2:
            self.graphicsState.camera_transform = 
            inverse(self.cameraPlaceholderLow.getLocalRigidbodyTransform());
            break;
        }
        
        if(self.selected_object !== null) {
            // Implement focus object code
            var camera_pos;
            switch(camera_mode) {
            case 1:
                camera_pos = self.cameraPlaceholder.getLocalRigidbodyTransform();
                break;
            case 2:
                camera_pos = self.cameraPlaceholderLow.getLocalRigidbodyTransform();
                break;
            }
            // var camera_pos = self.cameraPlaceholder.getLocalRigidbodyTransform();
            var cam_translation = new vec3(camera_pos[0][3],
                                           camera_pos[1][3],
                                           camera_pos[2][3]);
            var target_transform = self.selected_object.getLocalRigidbodyTransform();
            var target_translation = new vec3(target_transform[0][3],
                                              target_transform[1][3],
                                              target_transform[2][3]);
            var lookAtMatrix = lookAt(cam_translation, target_translation, new vec3(0, 1, 0));
            self.graphicsState.camera_transform = lookAtMatrix;
        }
    }
    else {
    	var leeway = 70,  degrees_per_frame = .0004 * animation_delta_time,
                      meters_per_frame  =   .01 * animation_delta_time;
        var turnSpeed = 0.5;
    										
        if( self.mouse.anchor ) // Dragging mode: Is a mouse drag occurring?
        {
            // Spin the camera around world y-axis and local x-axis
          var dragging_vector = subtract( self.mouse.from_center, self.mouse.anchor);
            var x = dragging_vector[0],
                y = dragging_vector[1];
            var localUp = mult_vec(self.graphicsState.camera_transform, new vec4(0, 1, 0, 0));

            self.graphicsState.camera_transform = mult( mult(rotation(turnSpeed * y, 1, 0, 0), rotation(turnSpeed * x, localUp[0], localUp[1], localUp[2]))
                ,self.graphicsState.camera_transform);
            self.mouse.anchor = self.mouse.from_center;
        }
        // self.graphicsState.camera_transform = mult( self.graphicsState.camera_transform,    // Post-multiply so we rotate the scene instead of the camera.
        //     mult( translation(origin),                                                      
        //     mult( rotation( .05 * length( dragging_vector ), dragging_vector[1], dragging_vector[0], 0 ), 
        //     translation(scale_vec( -1,origin ) ) ) ) );
        
          // Flyaround mode:  Determine camera rotation movement first
		var movement_plus  = [ self.mouse.from_center[0] + leeway, self.mouse.from_center[1] + leeway ];  // mouse_from_center[] is mouse position relative to canvas center;
		var movement_minus = [ self.mouse.from_center[0] - leeway, self.mouse.from_center[1] - leeway ];  // leeway is a tolerance from the center before it starts moving.
		
		// for( var i = 0; looking && i < 2; i++ )			// Steer according to "mouse_from_center" vector, but don't start increasing until outside a leeway window from the center.
		// {
		// 	var velocity = ( ( movement_minus[i] > 0 && movement_minus[i] ) || ( movement_plus[i] < 0 && movement_plus[i] ) ) * degrees_per_frame;	// Use movement's quantity unless the &&'s zero it out
		// 	self.graphicsState.camera_transform = mult( rotation( velocity, i, 1-i, 0 ), self.graphicsState.camera_transform );			// On X step, rotate around Y axis, and vice versa.
		// }
		self.graphicsState.camera_transform = mult( translation( scale_vec( meters_per_frame, thrust ) ), self.graphicsState.camera_transform );		// Now translation movement of camera, applied in local camera coordinate frame
    }
}

// A short function for testing.  It draws a lot of things at once.  See display() for a more basic look at how to draw one thing at a time.
Animation.prototype.test_lots_of_shapes = function( model_transform )
  {
    var shapes = [ this.m_prism, this.m_capped, this.m_cone, this.m_sub, this.m_sphere, this.m_obj, this.m_torus ];   // Randomly include some shapes in a list
    var tex_names = [ undefined, "stars.png", "earth.gif" ]
    
    for( var i = 3; i < shapes.length + 3; i++ )      // Iterate through that list
    {
      var spiral_transform = model_transform, funny_number = this.graphicsState.animation_time/20 + (i*i)*Math.cos( this.graphicsState.animation_time/2000 );
      spiral_transform = mult( spiral_transform, rotation( funny_number, i%3 == 0, i%3 == 1, i%3 == 2 ) );    
      for( var j = 1; j < 4; j++ )                                                                                  // Draw each shape 4 times, in different places
      {
        var mat = new Material( Color( i % j / 5, j % i / 5, i*j/25, 1 ), .3,  1,  1, 40, tex_names[ (i*j) % tex_names.length ] )       // Use a random material
        // The draw call:
        shapes[i-3].draw( this.graphicsState, spiral_transform, mat );			                        //  Draw the current shape in the list, passing in the current matrices		
        spiral_transform = mult( spiral_transform, rotation( 63, 3, 5, 7 ) );                       //  Move a little bit before drawing the next one
        spiral_transform = mult( spiral_transform, translation( 0, 5, 0) );
      } 
      model_transform = mult( model_transform, translation( 0, -3, 0 ) );
    }
    return model_transform;     
  }
    
// *******************************************************	
// display(): Called once per frame, whenever OpenGL decides it's time to redraw.

Animation.prototype.display = function(time)
	{  

		if(!time) time = 0;                                                               // Animate shapes based upon how much measured real time has transpired
		this.animation_delta_time = time - prev_time;                                     // by using animation_time
		if( animate ) this.graphicsState.animation_time += this.animation_delta_time;
		prev_time = time;

        fps_time_count += this.animation_delta_time;
        current_num_frames++;
		
		update_camera( this, this.animation_delta_time );
			
		var model_transform = mat4();	            // Reset this every frame.
		this.basis_id = 0;	                      // For the "axis" shape.  This variable uniquely marks each axis we draw in display() as it counts them up.
    
    shaders[ "Default" ].activate();                         // Keep the flags seen by the default shader program up-to-date
		gl.uniform1i( g_addrs.GOURAUD_loc, gouraud );		gl.uniform1i( g_addrs.COLOR_NORMALS_loc, color_normals);    
		
    
		// *** Lights: *** Values of vector or point lights over time.  Arguments to construct a Light(): position or vector (homogeneous coordinates), color, size
    // If you want more than two lights, you're going to need to increase a number in the vertex shader file (index.html).  For some reason this won't work in Firefox.
    this.graphicsState.lights = [];                    // First clear the light list each frame so we can replace & update lights.
    
    var light_orbit = [ Math.cos(this.graphicsState.animation_time/1000), Math.sin(this.graphicsState.animation_time/1000) ];
    this.graphicsState.lights.push( new Light( vec4(  30,  30,  34, 1 ), Color( 0, .4, 0, 1 ), 100000 ) );
    this.graphicsState.lights.push( new Light( vec4( 15, 30, 45, 0 ), Color( 1, 1, .3, 1 ), 100) );

    simulatePhysics(this.animation_delta_time / 1000);

    this.dispenseTimer += this.animation_delta_time;
    if(this.dispenseTimer >= this.dispenseTime) {
        dispense(this);
        this.dispenseTimer -= this.dispenseTime;
    }
    
		// *** Materials: *** Declare new ones as temps when needed; they're just cheap wrappers for some numbers.
		// 1st parameter:  Color (4 floats in RGBA format), 2nd: Ambient light, 3rd: Diffuse reflectivity, 4th: Specular reflectivity, 5th: Smoothness exponent, 6th: Texture image.
    /*
		var purplePlastic = new Material( Color( .9,.5,.9,1 ), .01, .2, .4, 40 ), // Omit the final (string) parameter if you want no texture
          greyPlastic = new Material( Color( .5,.5,.5,1 ), .01, .4, .2, 20 ),
                earth = new Material( Color( .5,.5,.5,1 ), .1,  1, .5, 40, "earth.gif" ),
                stars = new Material( Color( .5,.5,.5,1 ), .1,  1,  1, 40, "stars.png" ),
            ground = new Material( Color( 0, 0.6, 0, 1), 0.7, 0.5, 0.5, 40);
            */
			
		/**********************************
		Start coding down here!!!!
		**********************************/ 

    if(show_pick_shader)
        shaders["Pick_Shader"].activate();
// Extra code was added to Animation init and above Animation init
    this.staticObjects.drawRecursive();
    
    // Animate Objects
    var i, length = this.dynamicFunctions.length;
    for(i = 0; i < length; i++) {
        var obj, objectLength = this.dynamicFunctions[i].objects.length;
        for(obj = 0; obj < objectLength; obj++) {
            this.dynamicFunctions[i].update(this.dynamicFunctions[i].objects[obj], this.graphicsState.animation_time);
        }
    }
    
    // this.dynamicFunctions[0].update(this.dynamicFunctions[0].objects[0], this.graphicsState.animation_time / 20);
    this.dynamicObjects.drawRecursive(identity);
    
    /*
    model_transform = mult( model_transform, translation(0, -10, -15));
    this.m_cube.draw( this.graphicsState, mult( model_transform, scale(1000, 0.1, 1000)), ground);
    model_transform = mult(translation(0, 1, 0), model_transform);
    model_transform = mult(model_transform, rotation(45, 0, 0, 1));
    this.m_cube.draw( this.graphicsState, mult(model_transform, translation(1, 0, 0)), greyPlastic);
    model_transform = mult (model_transform, rotation(45, 0, 1, 0));
    this.m_cube.draw( this.graphicsState, mult(model_transform, translation(1, 0, 0)), greyPlastic);
    */
    
    /*
    // From this point on down it's just some examples for you -- feel free to comment it all out.

    // model_transform = mult( model_transform, translation( 0, 10, -15) );		// Position the next shape by post-multiplying another matrix onto the current matrix product
       
  //  Uncomment the next line if you want to see an example scene:     
  //  model_transform = this.test_lots_of_shapes( model_transform );  // An example of how to call other functions that you write, delegating work out to them, while keeping intact the concept 
                                                                      // of a "current model transform matrix".  Whatever it does internally to model_transform's state persists afterward.
    
    this.m_cube.draw( this.graphicsState, model_transform, greyPlastic );   // Cube example.  (Issue a command to draw one.)
     
    model_transform = mult( model_transform, translation( 0, -6, 0 ) );		
    CURRENT_BASIS_IS_WORTH_SHOWING( this, model_transform);                 // How to draw a set of axes.  Only the selected one is drawn - cycle through them by pressing p and m.
    
    model_transform = mult( model_transform, translation( 0, -3, 0 ) );											                // Example Translate
    model_transform = mult( model_transform, rotation( this.graphicsState.animation_time/20, 0, 1, 0 ) );		// Example Rotate. 1st parameter is scalar for angle, last three are axis of rotation.
    model_transform = mult( model_transform, scale( 4, 1, 4 ) );												                    // Example Scale
    
    this.m_strip.draw( this.graphicsState, model_transform, greyPlastic );	// Rectangle example.  (Issue a command to draw one.)  Notice the effect of the 3 previous lines.
    CURRENT_BASIS_IS_WORTH_SHOWING( this, model_transform);                 // Show another axis right where the rectangle is placed.
    CURRENT_BASIS_IS_WORTH_SHOWING( this, mat4() );                         // Show another axis placed at the world origin
    
    shaders[ "Demo_Shader" ].activate();
    model_transform = mult( model_transform, translation( 0, -2, 0 ) );
    this.m_sub.draw( this.graphicsState, model_transform, earth );     // Sphere example.  (Issue a command to draw one.)  Notice that we're still in the rectangle's warped coordinate system.
    */


    // **********************************************
        // Object creation functions
        //
        // function createGround(x, y, z, anim) {
        //     var material = new Material(Color(0, 1, 0, 1), 0.5, 1, 1, 20);
        //     var ground = new StaticObject(anim.graphicsState, anim.m_cube, material,
        //                                   translation(x, y, z),
        //                                   identity,
        //                                   scale(1000, 0.1, 1000));
        //     return ground;
        // }
        
        // function createStemSegment(x, y, z, anim) {
        //     var stemPivot = new DynamicObject(anim.graphicsState, null, null,
        //                                       translation(x, y, z),
        //                                       identity, identity);
            
        //     var stemMaterial = new Material(Color(0.4, 0.2, 0.04, 1), 0.3, 1, 1, 20);
        //     var stemMesh = new DynamicObject(anim.graphicsState, anim.m_cube, stemMaterial,
        //                                      translation(0, 1, 0),
        //                                      rotation(90, 1, 0, 0),
        //                                      scale(0.5, 0.5, 2));
        //     stemPivot.addChild(stemMesh);
        //     return stemPivot;
        // }
        
        // function animateStemSegments(segments, anim) {
        //     anim.dynamicFunctions.push({objects: segments, update: function(dObj, time) {
        //         dObj.setLocalRotation(2 * Math.sin(time / 2000), 0, 0, 1);
        //     }});
        // }
        
        // function createFlowerTop(x, y, z, anim) {
        //     var topMaterial = new Material(Color(0.6, 0.2, 0.2, 1), 0.3, 1, 1, 20);
        //     var flowerTop = new DynamicObject(anim.graphicsState, anim.m_rotation_disk, topMaterial,
        //                                       translation(x, y, z), identity,
        //                                       scale(3, 3, 3));
            
        //     return flowerTop;
        // }
        
        // function createFlower(x, y, z, numSegments, anim) {
        //     var stemBase = new DynamicObject(anim.graphicsState, null, null,
        //                                      translation(x, y, z),
        //                                      identity, identity);
            
        //     var i, stemSegments = [], previousSegment;
        //     previousSegment = createStemSegment(0, 0, 0, anim);
        //     stemBase.addChild(previousSegment);
        //     stemSegments.push(previousSegment);
            
        //     for(i = 1; i < numSegments; i++) {
        //         var newSegment = createStemSegment(0, 2, 0, anim);
        //         stemSegments.push(newSegment);
        //         previousSegment.addChild(newSegment);
        //         previousSegment = newSegment;
        //     }
            
        //     animateStemSegments(stemSegments, anim);
            
        //     previousSegment.addChild(createFlowerTop(0, 5, 0, anim));
            
        //     return stemBase;
        // }

        // function createLeg(x, y, z, left, anim) {
        //     var legMaterial = new Material(Color(0.4, 0.4, 0.4, 1), 0.1, 1, 1, 20);

        //     var newScale = identity;
        //     var axisFactor = 1;
        //     if(!left) {
        //         newScale = scale(-1, 1, 1);
        //         axisFactor = -1;
        //     }
        //     var topPivot = new DynamicObject(anim.graphicsState, null, null,
        //             translation(x, y, z), identity, newScale);
        //     var bottomPivot = new DynamicObject(anim.graphicsState, null, null,
        //             translation(2, 0, 0), identity, newScale);
        //     var topLegSegment = new DynamicObject(anim.graphicsState, anim.m_cube, legMaterial,
        //             translation(1, 0.2, 0), identity, scale(2, 0.4, 0.4));
        //     var bottomLegSegment = new DynamicObject(anim.graphicsState, anim.m_cube, legMaterial,
        //             translation(axisFactor * 1, 0.2, 0), identity, scale(2, 0.4, 0.4));

        //     topPivot.addChild(bottomPivot);
        //     topPivot.addChild(topLegSegment);
        //     bottomPivot.addChild(bottomLegSegment);

        //     function topRotation(dObj, time) {
        //         dObj.setLocalRotation(-60 + 30 * Math.cos(time / 750), 0, 0, axisFactor);
        //     }
        //     function bottomRotation(dObj, time) {
        //         dObj.setLocalRotation(-30 - 30 * Math.cos(time / 750), 0, 0, 1);
        //     }
        //     anim.dynamicFunctions.push({objects: [topPivot], update: topRotation});
        //     anim.dynamicFunctions.push({objects: [bottomPivot], update: bottomRotation});

        //     return topPivot;
        // }

        // function createBeeWing(x, y, z, left, anim) {
        //     var wingMaterial = new Material(Color(0.5, 0.5, 0.5, 1), 0.1, 1, 1, 20);
        //     var wing = new DynamicObject(anim.graphicsState, anim.m_cube, wingMaterial,
        //             translation(2, 0.1, 0), identity, scale(4, 0.2, 2));
        //     var wingContainer;
        //     if(left) {
        //         wingContainer = new DynamicObject(anim.graphicsState, null, null,
        //             translation(x, y, z), identity, identity);
        //         anim.dynamicFunctions.push({objects: [wingContainer], update: function (dObj, time) {
        //             dObj.setLocalRotation(-45 * Math.sin(time / 200), 0, 0, 1);
        //         }});
        //     } else {
        //         wingContainer = new DynamicObject(anim.graphicsState, null, null,
        //             translation(x, y, z), identity, scale(-1, 1, 1));
        //         anim.dynamicFunctions.push({objects: [wingContainer], update: function (dObj, time) {
        //             dObj.setLocalRotation(45 * Math.sin(time / 200), 0, 0, 1);
        //         }});
        //     }
        //     wingContainer.addChild(wing);

        //     return wingContainer;
        // }
        
        // function createBee(x, y, z, anim, dynamicFunctions) {
        //     var thoraxMaterial = new Material(Color(0.4, 0.4, 0.4, 1), 0.1, 1, 1, 20);
        //     var abdomenMaterial = new Material(Color(0.9, 0.9, 0.2, 1), 0.1, 1, 1, 20);
        //     var headMaterial = new Material(Color(0.4, 0.2, 0.6, 1), 0.1, 1, 1, 20);
            
        //     // The empty transform at the base of the flower with the bee will rotate around
        //     var rotationBase = new DynamicObject(anim.graphicsState, null, null,
        //                                          translation(x, y, z),
        //                                          identity, identity);
        //     function rotateBase(dObj, time) {
        //         dObj.setLocalRotation(-time / 20, 0, 1, 0);
        //     }
        //     dynamicFunctions.push({objects: [rotationBase], update: rotateBase});
            
        //     // The empty transform that will contain all parts of the bee
        //     var beeBase = new DynamicObject(anim.graphicsState, null, null,
        //                                     translation(10, 10, 0),
        //                                     identity, identity);
        //     rotationBase.addChild(beeBase);
        //     dynamicFunctions.push({objects: [beeBase], update: function (dObj, time) {
        //         dObj.setLocalTranslation(10, 10 + 2 * Math.sin(time / 200), 0);
        //     }});
            
        //     // The elongated cube thorax of bee
        //     var beeThorax = new DynamicObject(anim.graphicsState, anim.m_cube,
        //                                        thoraxMaterial,
        //                                        identity, identity,
        //                                        scale(1.5, 1.5, 4));
        //     // The ellipsoid on the back of the bee
        //     var beeAbdomen = new DynamicObject(anim.graphicsState, anim.m_sub,
        //         abdomenMaterial, translation(0, 0, -4.5), identity,
        //         scale(1.2, 1.2, 2.5));
        //     // The sphere on the front of the bee
        //     var beeHead = new DynamicObject(anim.graphicsState, anim.m_sub,
        //         headMaterial, translation(0, 0, 2.75), identity,
        //         scale(0.75, 0.75, 0.75));

        //     beeBase.addChild(beeThorax);
        //     beeBase.addChild(beeAbdomen);
        //     beeBase.addChild(beeHead);

        //     var wings = [
        //         createBeeWing(0.75, 0.75, 0, true, anim),
        //         createBeeWing(-0.75, 0.75, 0, false, anim)
        //     ];
        //     var i;
        //     for(i = 0; i < 2; i++) {
        //         beeBase.addChild(wings[i]);
        //     }

        //     var legs = [
        //         createLeg(0.75, -0.75, 0, true, anim),
        //         createLeg(0.75, -0.75, 1, true, anim),
        //         createLeg(0.75, -0.75, -1, true, anim),
        //         createLeg(-0.75, -0.75, 0, false, anim),
        //         createLeg(-0.75, -0.75, 1, false, anim),
        //         createLeg(-0.75, -0.75, -1, false, anim)
        //     ];

        //     var l;
        //     for(l = 0; l < legs.length; l++) {
        //         beeBase.addChild(legs[l]);
        //     }
            
        //     return rotationBase;
        // }
	}	