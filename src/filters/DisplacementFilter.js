import * as PIXI from "pixi.js";

const vertex = `
attribute vec2 aVertexPosition;

uniform mat3 projectionMatrix;
uniform mat3 filterMatrix;

varying vec2 vTextureCoord;
varying vec2 vFilterCoord;

uniform vec4 inputSize;
uniform vec4 outputFrame;

vec4 filterVertexPosition( void )
{
    vec2 position = aVertexPosition * max(outputFrame.zw, vec2(0.)) + outputFrame.xy;

    return vec4((projectionMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);
}

vec2 filterTextureCoord( void )
{
    return aVertexPosition * (outputFrame.zw * inputSize.zw);
}

void main(void)
{
	gl_Position = filterVertexPosition();
	vTextureCoord = filterTextureCoord();
	vFilterCoord = ( filterMatrix * vec3( vTextureCoord, 1.0)  ).xy;
}

`;

const fragment = `
varying vec2 vFilterCoord;
varying vec2 vTextureCoord;

uniform vec2 scale;
uniform mat2 rotation;
uniform sampler2D uSampler;
uniform sampler2D mapSampler;
uniform sampler2D nightTexture;

uniform highp vec4 inputSize;
uniform vec4 inputClamp;

void main(void)
{
  vec4 map =  texture2D(mapSampler, vFilterCoord);

  map -= 0.5;

  vec4 night =  texture2D(nightTexture, vTextureCoord);

  float coeff = min(1.0, night.r * 5.0);
  map.xy = scale * inputSize.zw * (rotation * map.xy) * (1.0 - coeff);
  

  gl_FragColor = texture2D(uSampler, clamp(vec2(vTextureCoord.x + map.x, vTextureCoord.y + map.y), inputClamp.xy, inputClamp.zw));
}
`;

export default class DisplacementFilter extends PIXI.Filter {
  /**
   * @param {PIXI.Sprite} sprite - The sprite used for the displacement map. (make sure its added to the scene!)
   * @param {number} [scale] - The scale of the displacement
   */
  constructor(sprite, scale) {
    const maskMatrix = new PIXI.Matrix();

    sprite.renderable = false;

    super(vertex, fragment, {
      mapSampler: sprite._texture,
      filterMatrix: maskMatrix,
      scale: { x: 1, y: 1 },
      rotation: new Float32Array([1, 0, 0, 1])
    });

    this.maskSprite = sprite;
    this.maskMatrix = maskMatrix;

    if (scale === null || scale === undefined) {
      scale = 20;
    }

    /**
     * scaleX, scaleY for displacements
     * @member {PIXI.Point}
     */
    this.scale = new PIXI.Point(scale, scale);
  }

  /**
   * Applies the filter.
   *
   * @param {PIXI.systems.FilterSystem} filterManager - The manager.
   * @param {PIXI.RenderTexture} input - The input target.
   * @param {PIXI.RenderTexture} output - The output target.
   * @param {boolean} clear - Should the output be cleared before rendering to it.
   */
  apply(filterManager, input, output, clear) {
    // fill maskMatrix with _normalized sprite texture coords_
    this.uniforms.filterMatrix = filterManager.calculateSpriteMatrix(
      this.maskMatrix,
      this.maskSprite
    );
    this.uniforms.scale.x = this.scale.x;
    this.uniforms.scale.y = this.scale.y;

    // Extract rotation from world transform
    const wt = this.maskSprite.transform.worldTransform;
    const lenX = Math.sqrt(wt.a * wt.a + wt.b * wt.b);
    const lenY = Math.sqrt(wt.c * wt.c + wt.d * wt.d);

    if (lenX !== 0 && lenY !== 0) {
      this.uniforms.rotation[0] = wt.a / lenX;
      this.uniforms.rotation[1] = wt.b / lenX;
      this.uniforms.rotation[2] = wt.c / lenY;
      this.uniforms.rotation[3] = wt.d / lenY;
    }

    // draw the filter...
    filterManager.applyFilter(this, input, output, clear);
  }

  /**
   * The texture used for the displacement map. Must be power of 2 sized texture.
   *
   * @member {PIXI.Texture}
   */
  get map() {
    return this.uniforms.mapSampler;
  }

  set map(
    value // eslint-disable-line require-jsdoc
  ) {
    this.uniforms.mapSampler = value;
  }
}
